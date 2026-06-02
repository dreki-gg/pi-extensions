---
'@dreki-gg/pi-plan-mode': minor
---

fix(plan-mode): multi-plan / cross-session drift + silent wrong-plan writes

Real-world report from a repo with many simultaneously-in-progress plans surfaced two trust-breakers plus several rough edges (see `FEEDBACK.md`). All addressed:

- **Registry status is now a projection of task state** (🔴 #1). Plan completion was coupled to a formal in-session execution run (`state.executing`), so a plan driven to all-tasks-`done` via `update_task` in another session/model stayed `in-progress` forever. `reconcilePlanStatus` now re-derives `plans.jsonl` status from `tasks.jsonl` on every task write (in `update_task` **and** `add_task`), decoupling completion from execution mode.
- **Explicit `plan` hint always wins** (🔴 #7). `resolveActivePlan` returned the in-memory `state.plan` before ever consulting an explicit `{ plan: "<name>" }` argument, so once a plan was submitted in a session every `update_task` / `add_task` silently pinned to it — landing writes in the wrong `tasks.jsonl`. The hint is now resolved **before** the in-memory short-circuit and re-attaches the named plan from disk.
- **New `update_plan` tool** (#2/#3): close or reopen a plan (`done` / `superseded` / `abandoned` / `in-progress`) with a `reason`, instead of hand-editing the registry or smuggling status into the title.
- **Widened plan status** (#3): `PlanManifestEntry.status` gains `superseded` and `abandoned`, plus an optional `reason`. Only `in-progress` is active; terminal statuses drop out of resolution and are never auto-overridden by reconciliation.
- **New `reconcile_plans` tool** (#6): walks every plan, reports drift (registry vs. derived task status), orphan task dirs, and registry-only plans; `apply: true` repairs safe `in-progress` ⇄ `done` drift.
- **`clean` archives instead of deletes** (#4): closed-plan directories move to `.plans/.archive/<name>/` by default (preserving HANDOFF.md + tasks.jsonl); true deletion is gated behind `--purge`. The CLI now reads `plans.jsonl` (was `plans.json`).
- **Multi-plan UX** (#5): `/plan focus <name>` pins the active plan so tracking calls default to it; `plan_status` with no arg and multiple in-progress plans renders a progress table (`7/17`, `8/8 ⚠ done?`) that surfaces reconcile candidates at a glance.
