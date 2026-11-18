// Guards against hallucinated findings: the model must quote real code
// near the reported line, and the quote must match the rule's anchor.

import type { Issue, RejectedIssue, Rule } from './types.ts';

/** Lines before/after the reported line where the quote may be found. */
const LINES_BEFORE = 3;
const LINES_AFTER = 8;

/** Formatting-insensitive form: no whitespace, no trailing commas. */
export function squash(text: string): string {
  return text.replace(/\s+/g, '').replace(/,(?=[)\]}])/g, '');
}

/** The quote may elide code with "..." or "…"; every fragment must appear in order. */
export function containsInOrder(haystack: string, evidence: string): boolean {
  let from = 0;
  for (const part of evidence.split(/\.\.\.|…/).map(squash).filter(Boolean)) {
    const at = haystack.indexOf(part, from);
    if (at === -1) {
      return false;
    }
    from = at + part.length;
  }
  return true;
}

/** Returns why the issue should be rejected, or null if it passes all checks. */
export function rejectReason(
  issue: Issue,
  sourceLines: readonly string[],
  rulesById: ReadonlyMap<string, Rule>,
): string | null {
  const rule = rulesById.get(issue.rule);
  if (!rule) {
    return `unknown rule "${issue.rule}"`;
  }
  if (!Number.isInteger(issue.line) || sourceLines[issue.line - 1] === undefined) {
    return `line ${issue.line} does not exist`;
  }
  const evidence = issue.evidence.trim();
  if (evidence.length < 2) {
    return 'no evidence quoted';
  }
  const start = Math.max(0, issue.line - 1 - LINES_BEFORE);
  const window = squash(sourceLines.slice(start, issue.line + LINES_AFTER).join('\n'));
  if (!containsInOrder(window, evidence)) {
    return `evidence not found near line ${issue.line}`;
  }
  if (rule.anchor && !rule.anchor.test(evidence)) {
    return `evidence does not match anchor ${rule.anchor}`;
  }
  return null;
}

export function verifyIssues(
  issues: readonly Issue[],
  sourceLines: readonly string[],
  rules: readonly Rule[],
): { accepted: Issue[]; rejected: RejectedIssue[] } {
  const rulesById = new Map(rules.map((r) => [r.id, r]));
  const accepted: Issue[] = [];
  const rejected: RejectedIssue[] = [];
  for (const issue of issues) {
    const reason = rejectReason(issue, sourceLines, rulesById);
    if (reason) {
      rejected.push({ issue, reason });
    } else {
      accepted.push(issue);
    }
  }
  return { accepted, rejected };
}
