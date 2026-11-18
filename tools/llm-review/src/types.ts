export const SEVERITIES = ['critical', 'major', 'minor'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** A rule as written in review-rules.json. */
export interface RuleDefinition {
  id: string;
  title: string;
  description: string;
  notAViolation?: string;
  anchor?: string;
}

/** A validated rule, ready to use. */
export interface Rule {
  id: string;
  title: string;
  description: string;
  notAViolation?: string;
  /** The quoted evidence must match this, otherwise the finding is rejected. */
  anchor: RegExp | null;
}

/** A single finding reported by the model. */
export interface Issue {
  line: number;
  rule: string;
  severity: Severity;
  evidence: string;
  message: string;
  suggestion?: string;
}

export interface RejectedIssue {
  issue: Issue;
  reason: string;
}

export interface FileReview {
  file: string;
  accepted: Issue[];
  rejected: RejectedIssue[];
  warnings: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface UsageStats {
  tokensIn: number;
  tokensOut: number;
}
