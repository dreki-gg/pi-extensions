# Code Quality

Evaluates changes for correctness, dead code introduction, and adherence to project lint/type standards.

## Criteria
- Does the diff introduce new lint violations or type errors?
- Are there new unused exports, imports, or variables?
- Does the change follow existing naming conventions?
- Are error cases handled properly?
- Are there any obvious bugs or logic errors?
- Does the code avoid known anti-patterns for the project's framework?

## Tools
- `bun run typecheck`
- `bun run lint`

## Severity
- blocker: Type errors, unresolved imports, obvious bugs, unhandled error paths
- warning: New lint violations, unused code, inconsistent naming
- note: Style suggestions, minor improvements
