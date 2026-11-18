export const SEVERITIES = ['critical', 'major', 'minor'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** A rule as written in review-rules.json. */
export interface RuleDefinition {
  id: string;
  title: string;
  description: string;
  notAViolation?: string;
  anchor?: string;
  /** Globs (relative to the repository root) of files the rule applies to. Default: all files. */
  files?: string[];
  /** Globs of files the rule never applies to. */
  exclude?: string[];
  /** Files the model sees as reference, e.g. the services whose logic must not be duplicated. */
  context?: string[];
}

/** A validated rule, ready to use. */
export interface Rule {
  id: string;
  title: string;
  description: string;
  notAViolation?: string;
  /** The quoted evidence must match this, otherwise the finding is rejected. */
  anchor: RegExp | null;
  files: string[];
  exclude: string[];
  context: string[];
}

/** A reference file shown to the model next to the code under review. */
export interface ContextFile {
  path: string;
  content: string;
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
  /** Ids of the rules that apply to this file. Empty: the file was not reviewed. */
  rulesApplied: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface UsageStats {
  tokensIn: number;
  tokensOut: number;
}
