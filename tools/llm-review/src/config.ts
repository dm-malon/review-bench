// Settings shared by the file and pull request entry points.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OllamaClient } from './ollama.ts';
import { loadRules } from './rules.ts';
import type { Rule } from './types.ts';

export const REPO_ROOT = resolve(import.meta.dirname, '../../..');
export const RULES_PATH = resolve(REPO_ROOT, 'review-rules.json');

/** Reads reference files from the local checkout. */
export function loadLocalContext(path: string): Promise<string> {
  return readFile(resolve(REPO_ROOT, path), 'utf8');
}

export function createOllamaClient(): OllamaClient {
  return new OllamaClient({
    url: process.env['OLLAMA_URL'] ?? 'http://localhost:11434',
    model: process.env['OLLAMA_MODEL'] ?? 'qwen2.5-coder:7b',
    timeoutMs: 5 * 60 * 1000,
    contextTokens: 16384,
  });
}

/** Loads rules, optionally keeping only the ids passed with --rule=R1,R3. */
export function selectRules(onlyRules: readonly string[] | null): Rule[] {
  const rules = loadRules(RULES_PATH).filter((r) => !onlyRules || onlyRules.includes(r.id));
  if (rules.length === 0) {
    throw new Error('No rules selected. Check --rule and review-rules.json.');
  }
  return rules;
}

/** Reads a `--name=value` flag. */
export function flagValue(argv: readonly string[], name: string): string | null {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : null;
}

export function ruleFilter(argv: readonly string[]): string[] | null {
  return flagValue(argv, 'rule')?.split(',') ?? null;
}
