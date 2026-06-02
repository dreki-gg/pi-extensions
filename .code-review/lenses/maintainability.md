# Maintainability

Review the diff for long-term maintainability against this repo's domain-driven,
TDD-first conventions for pi extension packages. Favor concrete structural feedback
over generic advice.

## Tools

- `bun run typecheck`

## Criteria

### Module organization (domain-driven)

- Large, growing `index.ts` files — AGENTS.md explicitly says to avoid big `index.ts`
  files and split logic into focused files/folders grouped by domain concept.
  Flag new code piled into an `index.ts` that should live in a domain module.
- A single file accreting unrelated responsibilities (parsing + I/O + UI wiring in one place).
- Logic that belongs in a shared/domain module being inlined into an extension entrypoint.

### Test coverage (TDD)

- New behavior in `packages/*/extensions/**` added without accompanying tests in the
  package's `test/**`. The convention is test-first; flag untested branches and edge cases.
- Tests that assert implementation details rather than observable behavior.
- Removed or weakened assertions in the diff.

### Naming and domain language (see CONTEXT.md)

- Drift from the project's ubiquitous language. Prefer the defined terms:
  "Modal Editor Extension", "Custom Editor", "Insert Mode", "Normal Mode", "Logical Line".
  Flag discouraged synonyms like "vim mode/support", "command mode", "visual line",
  "wrapped line" when the precise domain term applies.

### Simplicity without shortcuts

- Unnecessary abstraction / indirection for code with a single caller.
- Duplicated logic that should be factored into a shared helper.
- Dead code, commented-out blocks, or TODOs shipped without follow-up.
- Public API or config surface widened without need (extra exported knobs nobody calls).

### Package hygiene

- New runtime imports not reflected in the package's `dependencies`.
- Changes to a package that should be paired with a changeset entry (`.changeset/`) but isn't.
