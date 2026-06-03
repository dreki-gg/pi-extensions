# Code Quality

Evaluates changes for correctness, dead code introduction, and adherence to project lint/type standards.

## Criteria
- Does the diff introduce new lint violations or type errors?
- Are there new unused exports, imports, or variables?
- Does the change follow existing naming conventions?
- Are error cases handled properly?
- Are there any obvious bugs or logic errors?
- Does the code avoid known anti-patterns for the project's framework?

### Adversarial inputs (enumerate, don't assume)
For each changed function, construct the edge inputs that break it rather than
trusting the happy path or the surrounding comment:
- `null` / `undefined` / `NaN` / `Infinity` / `-0` / `""` / `[]` / `{}` / huge /
  negative / duplicate / out-of-order / unicode.
- Numeric-type guards that the wrong value defeats: `typeof NaN === "number"`,
  `typeof null === "object"`, `0`/`""`/`NaN` as falsy, `JSON.parse` of
  attacker input. Prefer `Number.isFinite` / explicit checks.
- **Claim-vs-code audit:** every comment or test that asserts an invariant
  ("non-numeric falls through", "never empty") — find the input that violates it
  and confirm the code actually enforces the claim.
- Off-by-one, boundary indices, wrong id/key space, missing `await`, swallowed
  errors, unhandled rejection, cancellation/abort paths.

## Tools
- `bun run typecheck`
- `bun run lint`

## Severity
- blocker: Type errors, unresolved imports, obvious bugs, unhandled error paths, an edge input (NaN/empty/boundary) that crashes or corrupts on a path users hit
- warning: New lint violations, unused code, inconsistent naming, an unguarded edge input on a lower-risk path, a comment/test claim the code does not actually honor
- note: Style suggestions, minor improvements
