import { readFileSync } from 'node:fs';
import { matchesAny } from './glob.ts';
import type { Rule, RuleDefinition } from './types.ts';

const REQUIRED_FIELDS = ['id', 'title', 'description'] as const;
const OPTIONAL_TEXT_FIELDS = ['notAViolation', 'anchor'] as const;
const OPTIONAL_LIST_FIELDS = ['files', 'exclude', 'context'] as const;

/**
 * Loads and validates review-rules.json.
 * Anchors are compiled here, so a broken regex fails fast with the rule id in the message.
 */
export function loadRules(path: string): Rule[] {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const list = isObject(parsed) ? parsed['rules'] : undefined;
  if (!Array.isArray(list)) {
    throw new Error(`${path}: expected { "rules": [...] }`);
  }

  const seen = new Set<string>();
  return list.map((entry: unknown, index) => {
    const definition = validateDefinition(entry, `${path}: rule #${index + 1}`);
    if (seen.has(definition.id)) {
      throw new Error(`${path}: duplicate rule id "${definition.id}"`);
    }
    seen.add(definition.id);
    return toRule(definition, path);
  });
}

function validateDefinition(entry: unknown, where: string): RuleDefinition {
  if (!isObject(entry)) {
    throw new Error(`${where} must be an object`);
  }
  for (const field of REQUIRED_FIELDS) {
    const value = entry[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${where} is missing "${field}"`);
    }
  }
  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (entry[field] !== undefined && typeof entry[field] !== 'string') {
      throw new Error(`${where}: "${field}" must be a string`);
    }
  }
  for (const field of OPTIONAL_LIST_FIELDS) {
    const value = entry[field];
    if (value !== undefined && !(Array.isArray(value) && value.every((item) => typeof item === 'string'))) {
      throw new Error(`${where}: "${field}" must be an array of strings`);
    }
  }
  return entry as unknown as RuleDefinition;
}

function toRule(definition: RuleDefinition, path: string): Rule {
  let anchor: RegExp | null = null;
  if (definition.anchor) {
    try {
      anchor = new RegExp(definition.anchor);
    } catch (error) {
      throw new Error(`${path}: rule ${definition.id} has an invalid anchor: ${String(error)}`);
    }
  }
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    notAViolation: definition.notAViolation,
    anchor,
    files: definition.files ?? [],
    exclude: definition.exclude ?? [],
    context: definition.context ?? [],
  };
}

/** Whether a rule applies to a file (path relative to the repository root). */
export function appliesTo(rule: Rule, path: string): boolean {
  const included = rule.files.length === 0 || matchesAny(path, rule.files);
  return included && !matchesAny(path, rule.exclude);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
