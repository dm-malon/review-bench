// Usage:
//   npm run review -- <file...> [--rule=R1,R3] [--all-in-one]
//
// Env:
//   OLLAMA_URL    default http://localhost:11434
//   OLLAMA_MODEL  default qwen2.5-coder:7b

import { relative, resolve } from 'node:path';
import { createOllamaClient, ruleFilter, selectRules } from './config.ts';
import { reviewFile } from './review.ts';
import type { FileReview, UsageStats } from './types.ts';

const USAGE = 'Usage: npm run review -- <file...> [--rule=R1,R3] [--all-in-one]';

interface CliArgs {
  files: string[];
  onlyRules: string[] | null;
  allInOne: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  return {
    files: argv.filter((a) => !a.startsWith('--')),
    onlyRules: ruleFilter(argv),
    allInOne: argv.includes('--all-in-one'),
  };
}

function printFileReview(review: FileReview): void {
  console.log(`── ${review.file}`);
  for (const warning of review.warnings) {
    console.log(`  ⚠ ${warning}`);
  }
  if (review.accepted.length === 0) {
    console.log('  ✓ no issues');
  }
  for (const issue of review.accepted) {
    console.log(`  L${issue.line}  [${issue.rule} · ${issue.severity}]  ${issue.message}`);
    console.log(`        code: ${issue.evidence.trim()}`);
    if (issue.suggestion) {
      console.log(`        fix:  ${issue.suggestion}`);
    }
  }
  for (const { issue, reason } of review.rejected) {
    console.log(`  ✗ rejected L${issue.line} [${issue.rule}] ${issue.message} — ${reason}`);
    console.log(`        code: ${issue.evidence.trim() || '(none)'}`);
  }
  console.log();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.files.length === 0) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const rules = selectRules(args.onlyRules);
  const client = createOllamaClient();
  const stats: UsageStats = { tokensIn: 0, tokensOut: 0 };
  const started = Date.now();
  let found = 0;

  console.log(
    `model=${client.config.model}  rules=${rules.map((r) => r.id).join(',')}  mode=${args.allInOne ? 'all-in-one' : 'per-rule'}\n`,
  );

  for (const file of args.files) {
    const label = relative(process.cwd(), resolve(file));
    const review = await reviewFile(file, label, rules, client, { allInOne: args.allInOne }, stats);
    printFileReview(review);
    found += review.accepted.length;
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `${found} issue(s) in ${args.files.length} file(s) · ${seconds}s · ${stats.tokensIn} tokens in / ${stats.tokensOut} out`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
