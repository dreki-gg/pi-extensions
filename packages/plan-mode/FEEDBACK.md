# Field notes — multi-plan / cross-session drift

Real-world report from a heavy user (viddy-go repo: **12 plans in `.plans/`, 11
simultaneously `in-progress`**, planning and execution routinely split across
sessions and models). Everything below is grounded in the current source, with
file:line refs. Ranked by impact.

---

## 1. 🔴 Plan completion is coupled to `state.executing` → registries silently drift

**Symptom.** A plan was driven to **17/17 tasks `done`** via `update_task`
across several sessions, yet `.plans/plans.jsonl` still showed it
`in-progress`. Same for several sibling plans whose work had already merged to
`main`. The registry never reflected reality and had to be hand-edited.

**Root cause.**

- `update_task` → `onTaskUpdated` (`index.ts:74`) writes **only** `tasks.jsonl`.
  It never touches the plan registry.
- The registry flip to `done` (`upsertPlanEntry(..., { status: 'done' })`)
  lives **only** in the `agent_end` handler, guarded by
  `if (state.executing && state.plan)` (`index.ts:238`, completion at
  `index.ts:384-391`).
- `resolveActivePlan` deliberately attaches plan data **without** setting
  `state.executing` (`resolve-plan.ts` docstring: "intentionally does NOT flip
  `executing`"). This is the correct call for tracking-from-disk — but it means
  the completion branch can never fire for cross-session `update_task` usage.

So: **the only path that closes a plan is a formal in-session execution run.**
Drive a plan to completion any other way (disk-attached tracking, a second
session, a different model picking up the work) and the registry is stranded at
`in-progress` forever.

**Suggested fix.** Decouple completion from `executing`. Recompute plan-level
status from task status wherever tasks are written — e.g. inside
`onTaskUpdated`, after `writeTasksJsonl`:

```ts
const allResolved = state.plan.tasks.every(
  (t) => t.status === 'done' || t.status === 'skipped',
);
const active = deferredTasks(state.plan.tasks).length === 0; // no pending follow-ups
if (allResolved && active) {
  await runPlanIO(upsertPlanEntry(state.plan.planName, { status: 'done', title: state.plan.title }));
}
```

Equivalently: make `writeTasksJsonl` (or a thin `reconcilePlanStatus(planName)`
helper) the single source that keeps `plans.jsonl.status` derived from
`tasks.jsonl`. The registry status should be a **projection** of task state, not
a parallel hand-maintained flag. Today they're two truths that drift.

---

## 2. 🟠 No plan-level lifecycle tool — closing a plan means hand-editing JSONL

There is `update_task` for task status, but **nothing** for plan status. To mark
a plan done/closed when it wasn't completed through an execution run, the only
options are:

- trigger a full `/plan-exec` session just to flip a flag, or
- hand-edit `.plans/plans.jsonl` (what I did — `python3` rewrite of the file).

Hand-editing a schema-validated registry (`schema.ts:42`) is exactly the kind of
thing the tool layer exists to prevent. Suggest a small tool/command, e.g.
`update_plan` / `/plan close <name> [--status superseded] [--reason "..."]`, or
at minimum a `reconcile_plans` command that re-derives every registry entry's
status from its `tasks.jsonl` and reports the diff.

---

## 3. 🟠 Only `in-progress | done` — no `superseded` / `abandoned` / `rejected`

`PlanManifestEntrySchema.status = Schema.Literal('in-progress', 'done')`
(`schema.ts:42`). Real backlogs have plans that are **rejected** (won't do) or
**superseded** (overlapping plan shipped the work). I hit both:

- `firestore-project-persistence` — **rejected** (no direct Firestore access via
  the rundot SDK). No valid status for it, so I had to mark it `done` and smuggle
  the reason into the **title** (`"... [REJECTED: no direct Firestore ...]"`).
  That's a lie in the data model (`done` implies it shipped) plus a title hack.
- `entity-doc-authoritative-model` — largely **superseded** by a later plan
  (`character-writer-effect`) that implemented the same model. No way to express
  "closed because another plan absorbed it."

Suggest widening the literal to something like
`'in-progress' | 'done' | 'superseded' | 'abandoned'` and adding an optional
`reason: Schema.optional(Schema.String)` to the entry. `plan_status` /
`resolve-plan` already filter on `status === 'in-progress'`, so any non-active
status correctly drops out of the candidate list — the new values would Just
Work for resolution while preserving honest history.

---

## 4. 🟠 `clean-plans` **deletes** done-plan directories — marking done can destroy history

`bin/clean-plans.js` removes the `.plans/<name>/` dir (HANDOFF.md + tasks.jsonl)
for every plan with `status === 'done'`. Combined with #1/#2, this is sharp:
the natural act of "close out a finished plan" makes its handoff + task ledger
deletion-eligible. For plans you keep around as a record (the entity-doc and
effect-foundation handoffs are genuinely useful context), that's lossy.

Suggest **archive instead of delete** — move to `.plans/.archive/<name>/` (or
gzip to `.plans/.archive/<name>.tar.gz`) — and/or require an explicit
`--purge` for true deletion. Default `clean` should be non-destructive.

---

## 5. 🟡 Multi-`in-progress` is a real mode, but the UX assumes a singleton

`resolveActivePlan` only auto-attaches when **exactly one** plan is in-progress
(`resolve-plan.ts`: `if (inProgress.length === 1)`). With 11 in-progress, every
`update_task` / `add_task` / `plan_status` call needs an explicit
`{ plan: "<name>" }`, and a bare `plan_status` dead-ends to a name list.

The disambiguation hint in `update-task.ts:60-64` is good ("Multiple
in-progress plans (...) — pass { plan: \"<name>\" }"), but the friction repeats
on every call. Suggestions:

- A session-scoped **"pin active plan"** (`/plan focus <name>`) so subsequent
  tracking calls default to it without repeating `plan:`. Store it in
  `state` (it already carries `planDir`/`plan`).
- `plan_status` with no arg + multiple in-progress: show a compact **table of
  all in-progress plans with their progress counts** (e.g. `7/17`, `3/8`)
  rather than just names — that progress-at-a-glance view is what you actually
  want when juggling many plans, and it surfaces drift (a `17/17` plan still
  listed as in-progress is an obvious reconcile candidate).

---

## 6. 🟡 No reconciliation between `tasks.jsonl` reality and registry status

Drift happened in **both** directions in this repo:

- tasks all `done` but registry `in-progress` (issue #1), and
- tasks `pending` but the work had already merged to `main` (planning/exec done
  in earlier sessions that never updated the ledger at all).

There's no command to detect or repair this. A `reconcile_plans` (see #2) that
walks every `.plans/<name>/tasks.jsonl`, recomputes status, and flags
"registry says X, tasks say Y" would have turned a 20-minute manual `python3`
cleanup into one call. Bonus: flag registry-only plans (no `tasks.jsonl` dir at
all — `setup-shadcn`, `e2e-regression-storage-primitives`, etc. here) so they're
visible as a distinct, un-trackable class.

---

## 7. 🔴 The `plan` hint on `update_task`/`add_task` is SILENTLY IGNORED — writes land in the wrong plan

**Reproduced live (data corruption, not cosmetic).** With several plans
in-progress, I called `update_task({ task_id: 't-001', status: 'done', plan:
'lorebot-contract', notes: '...' })`. It reported success — but marked t-001
done in **`effect-adoption-studio-wizard`** instead, applying my
lorebot-contract note to the wrong plan. The explicit `plan` argument was
ignored with zero warning.

**Root cause.** `resolveActivePlan` (`resolve-plan.ts`) returns the in-memory
`state.plan` *before* it ever looks at the `name` hint:

```ts
export async function resolveActivePlan(state, pi, runPlanIO, opts = {}) {
  if (state.plan) return { plan: state.plan, candidates: [] };   // ← hint never consulted
  // ... only here does it read opts.name / the manifest
}
```

`state.plan` is whatever the **last `submit_plan` in this session** attached
(here: `effect-adoption-studio-wizard`). So once you submit a plan, every
subsequent `update_task`/`add_task` is pinned to it and the `plan` parameter
is dead — even though the tool advertises it as the disambiguator and the user
passed it deliberately.

**Why it's 🔴, not 🟡.** The tool *succeeds*, reports the wrong plan's progress,
and writes to the wrong `tasks.jsonl`. The user/agent has no signal anything
went wrong. I only caught it because the success message quoted a task
description from the wrong plan. The recovery was hand-editing two
`tasks.jsonl` files with `python3`.

**Fix.** Honor an explicit `name`/`plan` hint **over** the in-memory default —
move the `opts.name` resolution ABOVE the `state.plan` short-circuit so an
explicit argument always wins over an implicit session default. Bonus: if
`state.plan` is used to satisfy a call that passed a *different* `plan` name,
surface a notice instead of silently diverging.

---

## Priority recap

| # | Issue | Fix shape | Impact |
|---|-------|-----------|--------|
| 1 | Completion coupled to `state.executing` | Derive registry status from tasks on every task write | 🔴 root cause of drift |
| 7 | Explicit `plan` hint ignored when `state.plan` set | Resolve `opts.name` BEFORE the `state.plan` short-circuit | 🔴 silent wrong-plan writes |
| 2 | No plan-level lifecycle tool | `update_plan` / `/plan close` + `reconcile_plans` | 🟠 |
| 3 | Only `in-progress\|done` | add `superseded`/`abandoned` + `reason` | 🟠 |
| 4 | `clean-plans` deletes done dirs | archive, not delete; gate true delete behind `--purge` | 🟠 |
| 5 | Singleton-plan UX assumption | `/plan focus`; progress table in `plan_status` | 🟡 |
| 6 | No drift reconciliation | `reconcile_plans` command | 🟡 |

**Two 🔴s, both trust-breakers:** #1 silently strands completed plans as
in-progress; #7 silently writes to the wrong plan. #1 is the highest-leverage
structural fix (make registry `status` a pure projection of task state); #7 is a
two-line reorder in `resolveActivePlan` and should ship immediately — it's an
active data-corruption path.
