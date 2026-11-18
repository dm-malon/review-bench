import { readFileSync } from 'node:fs';
import { verifyIssues } from './evidence.ts';
import type { OllamaClient } from './ollama.ts';
import { buildMessages } from './prompts.ts';
import { appliesTo } from './rules.ts';
import type { ContextFile, FileReview, Issue, Rule, Severity, UsageStats } from './types.ts';
import { SEVERITIES } from './types.ts';

/** Loads a reference file by its path relative to the repository root. */
export type ContextLoader = (path: string) => Promise<string>;

export interface ReviewOptions {
  /** true: all rules in one request (fast); false: one request per rule (more accurate). */
  allInOne: boolean;
  loadContext: ContextLoader;
}

const MAX_ATTEMPTS = 2;

/**
 * Reviews a file from disk. `label` is the path relative to the repository root:
 * rule scopes (files / exclude) are matched against it.
 */
export async function reviewFile(
  path: string,
  label: string,
  rules: readonly Rule[],
  client: OllamaClient,
  options: ReviewOptions,
  stats: UsageStats,
): Promise<FileReview> {
  return reviewSource(readFileSync(path, 'utf8'), label, rules, client, options, stats);
}

/** Reviews source text that did not come from the local disk, e.g. a file from a pull request. */
export async function reviewSource(
  source: string,
  label: string,
  rules: readonly Rule[],
  client: OllamaClient,
  options: ReviewOptions,
  stats: UsageStats,
): Promise<FileReview> {
  const applicable = rules.filter((rule) => appliesTo(rule, label));
  if (applicable.length === 0) {
    return { file: label, accepted: [], rejected: [], warnings: [], rulesApplied: [] };
  }

  const sourceLines = source.split('\n');
  const batches = options.allInOne ? [applicable] : applicable.map((rule) => [rule]);
  const warnings: string[] = [];
  const issues: Issue[] = [];

  for (const batch of batches) {
    const context = await loadContextFiles(batch, label, options.loadContext, warnings);
    const result = await askModel(client, batch, label, sourceLines, context, stats);
    issues.push(...result.issues);
    warnings.push(...result.warnings);
  }

  issues.sort((a, b) => a.line - b.line);
  return {
    file: label,
    ...verifyIssues(issues, sourceLines, applicable),
    warnings,
    rulesApplied: applicable.map((r) => r.id),
  };
}

/** Reference files of the rules in a batch; the file under review itself is never added. */
async function loadContextFiles(
  batch: readonly Rule[],
  label: string,
  loadContext: ContextLoader,
  warnings: string[],
): Promise<ContextFile[]> {
  const paths = [...new Set(batch.flatMap((rule) => rule.context))].filter((path) => path !== label);
  const files: ContextFile[] = [];
  for (const path of paths) {
    try {
      files.push({ path, content: await loadContext(path) });
    } catch (error) {
      warnings.push(`context file ${path} could not be loaded: ${errorMessage(error)}`);
    }
  }
  return files;
}

/** One batch of rules; retries once on an unparsable answer, then gives up with a warning. */
async function askModel(
  client: OllamaClient,
  batch: readonly Rule[],
  label: string,
  sourceLines: readonly string[],
  context: readonly ContextFile[],
  stats: UsageStats,
): Promise<{ issues: Issue[]; warnings: string[] }> {
  const messages = buildMessages(batch, label, sourceLines, context);
  const ids = batch.map((r) => r.id).join(',');
  const warnings: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await client.chat(messages);
    stats.tokensIn += result.tokensIn;
    stats.tokensOut += result.tokensOut;
    try {
      return { issues: parseIssues(result.content), warnings };
    } catch (error) {
      warnings.push(`invalid JSON for ${ids} (attempt ${attempt}/${MAX_ATTEMPTS}): ${errorMessage(error)}`);
    }
  }
  warnings.push(`skipped ${ids}: no valid answer from the model`);
  return { issues: [], warnings };
}

/**
 * Extracts {"issues": [...]} from the model's answer and normalises every item.
 * Malformed items are kept with empty fields, so the evidence check rejects them visibly.
 */
export function parseIssues(text: string): Issue[] {
  const cleaned = text.replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('no JSON object in the response');
  }
  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  const list = typeof parsed === 'object' && parsed !== null ? (parsed as { issues?: unknown }).issues : undefined;
  if (!Array.isArray(list)) {
    throw new Error('"issues" is not an array');
  }
  return list.map(toIssue);
}

function toIssue(raw: unknown): Issue {
  const item = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const severity = SEVERITIES.includes(item['severity'] as Severity) ? (item['severity'] as Severity) : 'minor';
  const suggestion = asText(item['suggestion']);
  return {
    line: Number(item['line']),
    rule: asText(item['rule']),
    severity,
    evidence: asText(item['evidence']),
    message: asText(item['message']),
    ...(suggestion ? { suggestion } : {}),
  };
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
