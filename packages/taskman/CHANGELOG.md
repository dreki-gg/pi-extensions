# @dreki-gg/taskman

## 0.4.0

### Minor Changes

- ffde28d: Plan into another project's `.plans/` and stop trusting in-memory plan status.

  - `submit_plan`, `revise_plan`, and `add_task` now accept an optional `target`
    pointing at another repo's root. When set, the plan is filed into that
    project's `.plans/` registry — handy when you're dogfooding project A, hit a
    gap in package B (which you author), and want the plan to live and later
    execute in B. Author-only: an external plan is never pinned as the current
    session's active plan, and a missing/invalid target is rejected up front.
  - The plan-mode status bar no longer renders progress counts (`📋 2/5`) or mode
    badges from in-memory state — that data drifted from disk. The agent reads
    real status from the ledger via `plan_status` instead.
  - `taskman` exposes `makeNodeFileSystemService(root)` and a `root` parameter on
    `makePlanRuntime` / `makeRuntimeLayer`, so the whole `.plans/` registry can be
    rooted at any working directory. Default behaviour (current working directory)
    is unchanged.

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
