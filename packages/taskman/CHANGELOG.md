# @dreki-gg/taskman

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
