# Review rules

Rules checked by the LLM reviewer (`tools/llm-review`).

Format of each rule:

- `## R<number> — <title>` — the heading; the number is the rule ID used in reports.
- `anchor:` — a regular expression (optional). The code the model quotes as evidence must match it,
  otherwise the finding is rejected as a hallucination.
- The text under the heading is sent to the model as is. Always describe what is **not** a violation —
  otherwise a small model finds problems everywhere.

## R1 — Do not use `any`

anchor: `\bany\b`

Do not use the TypeScript `any` type: `: any`, `as any`, `any[]`, `Array<any>`, `<any>`.
Use a concrete type, a generic, or `unknown` instead.
NOT a violation: the word "any" inside a string or a comment, or as part of a name such as `anyValue` or `company`.

## R2 — No `console.log`

anchor: `console\.log`

Do not leave `console.log(...)` calls in committed code.
NOT a violation: `console.error` or `console.warn`.

## R3 — Use `===` and `!==`

anchor: `[^=!<>]==[^=]|!=[^=]`

Compare values with strict equality `===` and `!==`. Every loose comparison `==` or `!=` is a violation.
NOT a violation: `===`, `!==`, or assignments such as `=`, `+=`, `=>`.

## R4 — No empty `catch`

anchor: `catch`

A `catch` block must handle the error: log it, show it to the user, or rethrow it.
A violation is a `catch` block that is empty or contains only comments, e.g. `catch {}` or `catch (e) { }`.
NOT a violation: a `catch` block with any statement inside.
