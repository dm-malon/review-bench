// Reviews open pull requests with the local model and posts one summary comment per PR.
//
// Usage:
//   npm run review:prs -- [--pr=1] [--repo=owner/name] [--dry-run] [--force] [--rule=R1,R3] [--all-in-one]
//
//   --pr        review only this pull request (default: all open ones)
//   --repo      repository (default: the one in the current directory)
//   --dry-run   print the comment instead of posting it
//   --force     review again even if the latest commit was already reviewed

import { createOllamaClient, flagValue, ruleFilter, selectRules } from './config.ts';
import { parseUnifiedDiff } from './diff.ts';
import type { PullRequest } from './github.ts';
import {
  createIssueComment,
  currentRepo,
  currentUser,
  getFileAtCommit,
  getPullRequest,
  getPullRequestDiff,
  listIssueComments,
  listOpenPullRequests,
  updateIssueComment,
} from './github.ts';
import type { OllamaClient } from './ollama.ts';
import type { PullRequestFileReview } from './report.ts';
import { buildComment, COMMENT_MARKER, reviewedSha } from './report.ts';
import { reviewSource } from './review.ts';
import type { Rule, UsageStats } from './types.ts';

const REVIEWED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|html)$/;

interface Options {
  repo: string;
  me: string;
  rules: Rule[];
  client: OllamaClient;
  allInOne: boolean;
  dryRun: boolean;
  force: boolean;
}

async function reviewPullRequest(pr: PullRequest, options: Options): Promise<void> {
  const { repo, me, rules, client } = options;
  console.log(`── PR #${pr.number} ${pr.title} (${pr.headRefOid.slice(0, 7)})`);

  const comments = await listIssueComments(repo, pr.number);
  const ownComment = comments.find((c) => c.user.login === me && c.body.includes(COMMENT_MARKER));
  if (ownComment && !options.force && reviewedSha(ownComment.body) === pr.headRefOid) {
    console.log('  already reviewed at this commit, skipping (use --force to review again)\n');
    return;
  }

  const changedFiles = parseUnifiedDiff(await getPullRequestDiff(repo, pr.number)).filter((f) =>
    REVIEWED_EXTENSIONS.test(f.path),
  );
  const stats: UsageStats = { tokensIn: 0, tokensOut: 0 };
  const started = Date.now();
  const files: PullRequestFileReview[] = [];

  // Reference files are read at the pull request's commit, so a PR that changes them is reviewed consistently.
  const contextCache = new Map<string, Promise<string>>();
  const loadContext = (path: string): Promise<string> => {
    if (!contextCache.has(path)) {
      contextCache.set(path, getFileAtCommit(repo, path, pr.headRefOid));
    }
    return contextCache.get(path)!;
  };

  for (const changed of changedFiles) {
    console.log(`  reviewing ${changed.path} (${changed.addedLines.size} changed line(s))`);
    const source = await getFileAtCommit(repo, changed.path, pr.headRefOid);
    const review = await reviewSource(source, changed.path, rules, client, { allInOne: options.allInOne, loadContext }, stats);
    if (review.rulesApplied.length === 0) {
      console.log('    no rules apply, skipped');
      continue;
    }
    const inDiff = review.accepted.filter((issue) => changed.addedLines.has(issue.line));
    files.push({
      path: changed.path,
      accepted: inDiff,
      rejected: review.rejected.filter((r) => changed.addedLines.has(r.issue.line)),
      outsideDiff: review.accepted.length - inDiff.length,
      warnings: review.warnings,
    });
  }

  const body = buildComment({
    repo,
    sha: pr.headRefOid,
    model: client.config.model,
    rules,
    seconds: (Date.now() - started) / 1000,
    files,
  });

  if (options.dryRun) {
    console.log('\n----- comment (dry run, not posted) -----\n');
    console.log(body);
    console.log('\n-----------------------------------------\n');
    return;
  }
  if (ownComment) {
    await updateIssueComment(repo, ownComment.id, body);
    console.log(`  updated comment: ${pr.url}#issuecomment-${ownComment.id}\n`);
  } else {
    await createIssueComment(repo, pr.number, body);
    console.log(`  posted comment on ${pr.url}\n`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const repo = flagValue(argv, 'repo') ?? (await currentRepo());
  const prNumber = flagValue(argv, 'pr');
  const options: Options = {
    repo,
    me: await currentUser(),
    rules: selectRules(ruleFilter(argv)),
    client: createOllamaClient(),
    allInOne: argv.includes('--all-in-one'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
  };

  const pullRequests = prNumber
    ? [await getPullRequest(repo, Number(prNumber))]
    : await listOpenPullRequests(repo);

  console.log(
    `repo=${repo}  model=${options.client.config.model}  rules=${options.rules.map((r) => r.id).join(',')}  ` +
      `prs=${pullRequests.length}${options.dryRun ? '  (dry run)' : ''}\n`,
  );
  for (const pr of pullRequests) {
    await reviewPullRequest(pr, options);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
