# @dreki-gg/taskman

## 0.2.0

### Minor Changes

- New package: `@dreki-gg/taskman` — the plan-mode task-management engine extracted
  into a standalone, pi-independent library plus a `taskman` CLI. Drive the same
  `.plans/` JSONL ledger (plans, initiatives, tasks, status projection/reconcile)
  from any Node harness: `taskman status`, `list`, `initiatives`,
  `initiative-status`, `update-task`, `add-task`, `reconcile`, `close`, and
  `close-initiative` — human output by default, `--json` for machines.
