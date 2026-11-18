# Review Bench

A demo bench for automated code review, built step by step:

1. ✅ **Team rules** — [`review-rules.md`](review-rules.md).
2. ✅ **LLM reviewer on a local Ollama model** — [`tools/llm-review/review.mjs`](tools/llm-review/review.mjs).
3. ⏳ SonarQube (static analysis, quality gate).
4. ⏳ Review comments on pull requests.

## Rules

| ID  | Rule                                     |
| --- | ---------------------------------------- |
| R1  | Do not use `any`                         |
| R2  | No `console.log`                         |
| R3  | Use `===` / `!==` instead of `==` / `!=` |
| R4  | No empty `catch`                         |

The rule format is described at the top of `review-rules.md`. To add a rule, add a new `## R5 — ...` section.

## Running the review locally

Requires Node.js 22+ and [Ollama](https://ollama.com):

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

## How the reviewer guards against hallucinations

- By default each rule is checked in a **separate request**. A small model is more careful when it has one question to answer.
- The model must **quote the code** it refers to (`evidence`). The script checks that the quote really exists near the reported line and matches the rule's `anchor`. Otherwise the finding is dropped and shown as `rejected`.
- If the model returns invalid JSON, the script retries once and then skips that rule with a warning.
