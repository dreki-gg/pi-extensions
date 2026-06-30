---
"@dreki-gg/pi-plan-mode": minor
"@dreki-gg/taskman": minor
---

Plan into another project's `.plans/` and stop trusting in-memory plan status.

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
