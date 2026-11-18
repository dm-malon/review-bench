// Everything the model reads lives in this file: how rules are described,
// the system prompt with the answer format, and how code is presented.
// Tune the reviewer's behaviour here; the rest of the code only moves data around.

import type { ChatMessage, Rule } from './types.ts';
import { SEVERITIES } from './types.ts';

/** How one rule is presented to the model. */
export function describeRule(rule: Rule): string {
  const lines = [`${rule.id}: ${rule.title}`, rule.description];
  if (rule.notAViolation) {
    lines.push(`NOT a violation: ${rule.notAViolation}`);
  }
  return lines.join('\n');
}

/** System prompt: the role, the rules to check, and the exact JSON shape of the answer. */
export function systemPrompt(rules: readonly Rule[]): string {
  const ruleIds = rules.map((r) => `"${r.id}"`).join('|');
  const severities = SEVERITIES.map((s) => `"${s}"`).join('|');

  return `You are a strict code reviewer. Review the code ONLY against these team rules:

${rules.map(describeRule).join('\n\n')}

Respond ONLY with JSON:
{"issues":[{"line":number,"rule":${ruleIds},"severity":${severities},"evidence":string,"message":string,"suggestion":string}]}
- "evidence" MUST be an exact code fragment copied from that line (without the line number) that proves the violation.
- Use line numbers from the numbered code. Report each problem once.
- Report a problem ONLY if it really exists in the code.
- If nothing is wrong return {"issues":[]} - an empty list is a perfectly good answer.`;
}

/** Prefixes every line with its number so the model can point at lines. */
export function numberLines(sourceLines: readonly string[]): string {
  return sourceLines.map((line, i) => `${i + 1}: ${line}`).join('\n');
}

/** User message: the file to review. */
export function userPrompt(fileLabel: string, sourceLines: readonly string[]): string {
  return `File: ${fileLabel}\n\n${numberLines(sourceLines)}`;
}

export function buildMessages(
  rules: readonly Rule[],
  fileLabel: string,
  sourceLines: readonly string[],
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(rules) },
    { role: 'user', content: userPrompt(fileLabel, sourceLines) },
  ];
}
