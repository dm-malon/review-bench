# Review Bench

A demo bench for automated code review, built step by step:

0. ✅ **Angular app** in `src/` — the code under review: a customer page, the internal `<app-input>` and two domain services.
1. ✅ **Team rules** — [`review-rules.json`](review-rules.json).
2. ✅ **LLM reviewer on a local Ollama model** — [`tools/llm-review/src`](tools/llm-review/src).
3. ✅ **SonarQube Cloud** — static analysis on every push to `main` and every pull request ([`.github/workflows/sonar.yml`](.github/workflows/sonar.yml)).
4. ✅ **Review comments on pull requests** from the local model (`npm run review:prs`).

## Rules

| ID  | Rule                                                      | Applies to                         |
| --- | --------------------------------------------------------- | ---------------------------------- |
| R1  | Do not use `any`                                          | everything except `tools/`         |
| R2  | No `console.log`                                          | everything except `tools/`         |
| R3  | Use `===` / `!==` instead of `==` / `!=`                  | everything except `tools/`         |
| R4  | No empty `catch`                                          | everything except `tools/`         |
| R5  | Text inputs use the internal `<app-input>` only           | UI code in `src/`                  |
| R6  | Customer / employee logic stays in their domain services  | `src/**/*.ts` outside `domain/`    |

To add a rule, append an object to `rules` in `review-rules.json`:

```json
{
  "id": "R7",
  "title": "Short name",
  "description": "What is a violation. Sent to the model as is.",
  "notAViolation": "What looks similar but is fine. Optional, but small models need it.",
  "anchor": "regex the quoted code must match (optional)",
  "files": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"],
  "context": ["src/app/domain/customer/customer.service.ts"]
}
```

- `files` / `exclude` — globs relative to the repository root that limit where the rule applies.
- `context` — files the model sees as reference but does not review. R6 uses it to show the model what `CustomerService` and `EmployeeService` already do.

Write rules in English: local models follow it more reliably. In `anchor`, backslashes are escaped as in any JSON string (`\\b` for `\b`).

## Running the review locally

Requires Node.js 22.18+ (runs TypeScript directly, no build step) and [Ollama](https://ollama.com):

```bash
brew install ollama
brew services start ollama
ollama pull qwen2.5-coder:7b
```

Review one or more files:

```bash
npm run review -- path/to/file.ts
npm run review -- path/to/file.ts --rule=R1,R3   # selected rules only
npm run review -- path/to/file.ts --all-in-one   # all rules in one request: faster, less accurate
```

Environment variables: `OLLAMA_URL` (default `http://localhost:11434`) and `OLLAMA_MODEL` (default `qwen2.5-coder:7b`).

For the deeper rules (R5, R6) a stronger model is much more precise: `OLLAMA_MODEL=qwen3.5:9b npm run review -- ...` (about twice as slow).

## Reviewing pull requests with the local model

GitHub cannot reach a model on your machine, so your machine asks GitHub instead:

```bash
npm run review:prs -- --dry-run   # review all open PRs, print the comment, post nothing
npm run review:prs                # review and post one comment per PR
npm run review:prs -- --pr=1      # only PR #1
npm run review:prs -- --force     # review again even if the latest commit was already reviewed
```

How it works:

1. `gh` lists open pull requests and downloads each diff.
2. Every changed JS/TS file is fetched at the pull request's commit **as text**. Nothing from the pull request is executed, so this is safe for a public repository.
3. The file is reviewed like a local file; only findings on lines the pull request added are reported.
4. One comment per pull request, marked with `<!-- llm-review -->`, is created or updated in place. The reviewed commit is stored in the comment, so an unchanged pull request is skipped.

Requires the GitHub CLI logged in to an account that can comment on the repository (`gh auth status`).

## How the reviewer guards against hallucinations

- By default each rule is checked in a **separate request**. A small model is more careful when it has one question to answer.
- The model must **quote the code** it refers to (`evidence`). The script checks that the quote really exists near the reported line and matches the rule's `anchor`. Otherwise the finding is dropped and shown as `rejected`.
- If the model returns invalid JSON, the script retries once and then skips that rule with a warning.

## App

```bash
npm start          # http://localhost:4200
npm test           # unit tests in watch mode
npm run test:ci    # unit tests once + coverage/review-bench/lcov.info
```

## SonarQube Cloud

Analysis runs in GitHub Actions on every push to `main` and on every pull request: install, unit tests with coverage, then the scan. Only `src/` is analyzed.
Settings live in [`sonar-project.properties`](sonar-project.properties); the workflow needs one repository secret, `SONAR_TOKEN`.
Automatic Analysis must be **off** in the SonarQube Cloud project, because the analysis runs in CI.

## Reviewer code

TypeScript, run directly by Node (type stripping), so there is no build step. `npm run typecheck` checks types.

| File | Responsibility |
| --- | --- |
| [`prompts.ts`](tools/llm-review/src/prompts.ts) | **Everything the model reads:** rule descriptions, system prompt, answer format, how code is presented |
| [`rules.ts`](tools/llm-review/src/rules.ts) | Loads and validates `review-rules.json` |
| [`ollama.ts`](tools/llm-review/src/ollama.ts) | Ollama `/api/chat` client, fallback for runners without structured output |
| [`review.ts`](tools/llm-review/src/review.ts) | Reviews one file: batches of rules, retry on invalid JSON, parses the answer |
| [`evidence.ts`](tools/llm-review/src/evidence.ts) | Rejects findings whose quoted code is not in the file or does not match the rule's anchor |
| [`cli.ts`](tools/llm-review/src/cli.ts) | `npm run review`: reviews local files, prints to the terminal |
| [`pr-cli.ts`](tools/llm-review/src/pr-cli.ts) | `npm run review:prs`: reviews open pull requests, posts a comment |
| [`github.ts`](tools/llm-review/src/github.ts) | GitHub access through the `gh` CLI |
| [`diff.ts`](tools/llm-review/src/diff.ts) | Finds the lines a pull request added |
| [`report.ts`](tools/llm-review/src/report.ts) | Builds the pull request comment, sanitises model output |
| [`config.ts`](tools/llm-review/src/config.ts) | Shared settings: Ollama client, rules file, repository root |
| [`glob.ts`](tools/llm-review/src/glob.ts) | Glob matching for rule scopes |
