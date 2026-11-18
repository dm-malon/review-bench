#!/usr/bin/env node
// LLM code reviewer: checks files against review-rules.json using a local Ollama model.
//
// Usage:
//   node tools/llm-review/review.mjs <file...> [--rule=R1,R3] [--all-in-one]
//
// Env:
//   OLLAMA_URL    default http://localhost:11434
//   OLLAMA_MODEL  default qwen2.5-coder:7b

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b';
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const RULES_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../review-rules.json');

// ---------- CLI ----------

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const allInOne = args.includes('--all-in-one');
const onlyRules = args
  .find((a) => a.startsWith('--rule='))
  ?.slice('--rule='.length)
  .split(',');

if (files.length === 0) {
  console.error('Usage: node tools/llm-review/review.mjs <file...> [--rule=R1,R3] [--all-in-one]');
  process.exit(1);
}

// ---------- Rules ----------

/**
 * Loads review-rules.json. Each rule: { id, title, description, notAViolation?, anchor? }.
 * `anchor` is a regex the quoted evidence must match; it is compiled here so a typo fails fast.
 */
function loadRules(path) {
  const { rules } = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(rules)) throw new Error(`${path}: "rules" must be an array`);
  const seen = new Set();
  return rules.map((rule, index) => {
    for (const field of ['id', 'title', 'description']) {
      if (typeof rule[field] !== 'string' || rule[field].trim() === '') {
        throw new Error(`${path}: rule #${index + 1} is missing "${field}"`);
      }
    }
    if (seen.has(rule.id)) throw new Error(`${path}: duplicate rule id "${rule.id}"`);
    seen.add(rule.id);
    const text = rule.notAViolation
      ? `${rule.description}\nNOT a violation: ${rule.notAViolation}`
      : rule.description;
    return {
      id: rule.id,
      title: rule.title,
      text,
      anchor: rule.anchor ? new RegExp(rule.anchor) : null,
    };
  });
}

const rules = loadRules(RULES_PATH).filter((r) => !onlyRules || onlyRules.includes(r.id));
if (rules.length === 0) {
  console.error(`No rules selected (check --rule and ${relative(process.cwd(), RULES_PATH)}).`);
  process.exit(1);
}

// ---------- Prompt ----------

function systemPrompt(batch) {
  const ruleText = batch.map((r) => `${r.id}: ${r.title}\n${r.text}`).join('\n\n');
  const ids = batch.map((r) => `"${r.id}"`).join('|');
  return `You are a strict code reviewer. Review the code ONLY against these team rules:

${ruleText}

Respond ONLY with JSON:
{"issues":[{"line":number,"rule":${ids},"severity":"critical"|"major"|"minor","evidence":string,"message":string,"suggestion":string}]}
- "evidence" MUST be an exact code fragment copied from that line (without the line number) that proves the violation.
- Use line numbers from the numbered code. Report each problem once.
- Report a problem ONLY if it really exists in the code.
- If nothing is wrong return {"issues":[]} - an empty list is a perfectly good answer.`;
}

// ---------- Ollama ----------

// Some runners (e.g. MLX on Apple Silicon) do not support grammar-constrained output
// and answer 501. Then we switch to plain text with thinking off and extract JSON ourselves.
let structuredOutput = true;

async function callOllama(messages) {
  const body = {
    model: OLLAMA_MODEL,
    stream: false,
    options: { temperature: 0, num_ctx: 8192 },
    messages,
  };
  if (structuredOutput) body.format = 'json';
  else body.think = false;
  return fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function extractJson(text) {
  const cleaned = String(text ?? '').replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in the response');
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed.issues)) throw new Error('"issues" is not an array');
  return parsed.issues;
}

/** Returns issues for one batch of rules; one retry on invalid JSON, then gives up with a warning. */
async function reviewBatch(fileLabel, numberedCode, batch, stats) {
  const messages = [
    { role: 'system', content: systemPrompt(batch) },
    { role: 'user', content: `File: ${fileLabel}\n\n${numberedCode}` },
  ];
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res = await callOllama(messages);
    if (res.status === 501 && structuredOutput) {
      structuredOutput = false;
      console.warn('  (model has no structured output support: using plain JSON text, thinking off)');
      res = await callOllama(messages);
    }
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    stats.tokensIn += data.prompt_eval_count ?? 0;
    stats.tokensOut += data.eval_count ?? 0;
    try {
      return extractJson(data.message?.content);
    } catch (error) {
      const ids = batch.map((r) => r.id).join(',');
      console.warn(`  ⚠ invalid JSON for ${ids} (attempt ${attempt}/2): ${error.message}`);
    }
  }
  return [];
}

// ---------- Evidence check ----------

const squash = (text) =>
  String(text ?? '')
    .replace(/\s+/g, '')
    .replace(/,(?=[)\]}])/g, '');

/** Evidence may elide code with "..." or "…"; every fragment must appear in order. */
function containsInOrder(haystack, evidence) {
  let from = 0;
  for (const part of evidence.split(/\.\.\.|…/).map(squash).filter(Boolean)) {
    const at = haystack.indexOf(part, from);
    if (at === -1) return false;
    from = at + part.length;
  }
  return true;
}

function rejectReason(issue, sourceLines, rulesById) {
  const rule = rulesById.get(issue.rule);
  if (!rule) return `unknown rule "${issue.rule}"`;
  if (!Number.isInteger(issue.line) || sourceLines[issue.line - 1] === undefined) {
    return `line ${issue.line} does not exist`;
  }
  const evidence = String(issue.evidence ?? '').trim();
  if (evidence.length < 2) return 'no evidence quoted';
  const window = squash(sourceLines.slice(Math.max(0, issue.line - 4), issue.line + 8).join('\n'));
  if (!containsInOrder(window, evidence)) return `evidence not found near line ${issue.line}`;
  if (rule.anchor && !rule.anchor.test(evidence)) return `evidence does not match anchor ${rule.anchor}`;
  return null;
}

// ---------- Main ----------

const rulesById = new Map(rules.map((r) => [r.id, r]));
const batches = allInOne ? [rules] : rules.map((r) => [r]);
const stats = { tokensIn: 0, tokensOut: 0 };
const started = Date.now();
let totalAccepted = 0;

console.log(
  `model=${OLLAMA_MODEL}  rules=${rules.map((r) => r.id).join(',')}  mode=${allInOne ? 'all-in-one' : 'per-rule'}\n`,
);

for (const file of files) {
  const label = relative(process.cwd(), resolve(file));
  const sourceLines = readFileSync(file, 'utf8').split('\n');
  const numberedCode = sourceLines.map((line, i) => `${i + 1}: ${line}`).join('\n');

  const issues = [];
  for (const batch of batches) {
    issues.push(...(await reviewBatch(label, numberedCode, batch, stats)));
  }

  const accepted = [];
  const rejected = [];
  for (const issue of issues.sort((a, b) => a.line - b.line)) {
    const reason = rejectReason(issue, sourceLines, rulesById);
    if (reason) rejected.push({ issue, reason });
    else accepted.push(issue);
  }
  totalAccepted += accepted.length;

  console.log(`── ${label}`);
  if (accepted.length === 0) console.log('  ✓ no issues');
  for (const i of accepted) {
    console.log(`  L${i.line}  [${i.rule} · ${i.severity}]  ${i.message}`);
    console.log(`        code: ${String(i.evidence).trim()}`);
    if (i.suggestion) console.log(`        fix:  ${i.suggestion}`);
  }
  for (const { issue, reason } of rejected) {
    console.log(`  ✗ rejected L${issue.line} [${issue.rule}] ${issue.message} — ${reason}`);
  }
  console.log();
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `${totalAccepted} issue(s) in ${files.length} file(s) · ${seconds}s · ${stats.tokensIn} tokens in / ${stats.tokensOut} out`,
);
