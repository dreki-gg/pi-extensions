# @dreki-gg/taskman

## 0.3.1

### Patch Changes

- Document the `create-plan` and `create-handoff` CLI commands in the taskman
  skill and README, including the "create plans from any harness" pattern
  (inline / `--*-file` / stdin payloads) and how plan setup differs from the
  deferred `add-task` follow-up flow.

## 0.3.0

### Minor Changes

- Add `taskman create-plan` and `taskman create-handoff` CLI commands so any
  external harness can create a plan (tasks.jsonl + HANDOFF.md + registry entry,
  with optional initiative linking) or write a plan's HANDOFF.md without going
  through the plan-mode extension. Handoff and task payloads can be passed inline,
  from a file, or piped on stdin.

## 0.2.2

### Patch Changes

- Fix `taskman -V` / `--version` reporting a stale hardcoded version. The CLI now
  reads the version from the shipped `package.json` at runtime, so it always
  matches the installed package.

## 0.2.1

### Patch Changes

- Ship docs + an agent skill in the package. Adds a README (the `.plans/` ledger
  contract and three durable invariants, pointing to `taskman --help` as the
  source of truth for commands/flags) and a TanStack Intent skill
  (`skills/taskman/core`) so AI coding agents on any harness auto-discover how to
  use taskman correctly — versioned with the package, not the model's training
  cutoff.

## 0.2.0

### Minor Changes

- New package: `@dreki-gg/taskman` — the plan-mode task-management engine extracted
  into a standalone, pi-independent library plus a `taskman` CLI. Drive the same
  `.plans/` JSONL ledger (plans, initiatives, tasks, status projection/reconcile)
  from any Node harness: `taskman status`, `list`, `initiatives`,
  `initiative-status`, `update-task`, `add-task`, `reconcile`, `close`, and
  `close-initiative` — human output by default, `--json` for machines.
