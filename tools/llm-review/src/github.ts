// Thin wrapper around the GitHub CLI (`gh`). The pull request's code is only read as text;
// nothing from the pull request is ever executed.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

async function gh(args: string[]): Promise<string> {
  try {
    const { stdout } = await run('gh', args, { maxBuffer: MAX_OUTPUT_BYTES });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`gh ${args.slice(0, 3).join(' ')} failed: ${stderr || String(error)}`);
  }
}

async function ghJson<T>(args: string[]): Promise<T> {
  return JSON.parse(await gh(args)) as T;
}

export interface PullRequest {
  number: number;
  title: string;
  headRefOid: string;
  url: string;
}

export interface IssueComment {
  id: number;
  body: string;
  user: { login: string };
}

export async function currentRepo(): Promise<string> {
  const repo = await ghJson<{ nameWithOwner: string }>(['repo', 'view', '--json', 'nameWithOwner']);
  return repo.nameWithOwner;
}

export async function currentUser(): Promise<string> {
  return (await gh(['api', 'user', '--jq', '.login'])).trim();
}

export async function listOpenPullRequests(repo: string): Promise<PullRequest[]> {
  return ghJson<PullRequest[]>([
    'pr', 'list', '--repo', repo, '--state', 'open', '--json', 'number,title,headRefOid,url',
  ]);
}

export async function getPullRequest(repo: string, number: number): Promise<PullRequest> {
  return ghJson<PullRequest>([
    'pr', 'view', String(number), '--repo', repo, '--json', 'number,title,headRefOid,url',
  ]);
}

export async function getPullRequestDiff(repo: string, number: number): Promise<string> {
  return gh(['pr', 'diff', String(number), '--repo', repo]);
}

/** File content at a given commit, as text. */
export async function getFileAtCommit(repo: string, path: string, sha: string): Promise<string> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return gh([
    'api', `repos/${repo}/contents/${encodedPath}?ref=${sha}`,
    '-H', 'Accept: application/vnd.github.raw',
  ]);
}

export async function listIssueComments(repo: string, number: number): Promise<IssueComment[]> {
  const pages = await ghJson<IssueComment[][]>([
    'api', '--paginate', '--slurp', `repos/${repo}/issues/${number}/comments`,
  ]);
  return pages.flat();
}

export async function createIssueComment(repo: string, number: number, body: string): Promise<void> {
  await gh(['api', '-X', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`]);
}

export async function updateIssueComment(repo: string, commentId: number, body: string): Promise<void> {
  await gh(['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${commentId}`, '-f', `body=${body}`]);
}
