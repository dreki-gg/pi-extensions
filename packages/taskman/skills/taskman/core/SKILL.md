---
name: taskman/core
description: >
  Drive the taskman CLI and engine over a .plans/ JSONL ledger — plans,
  initiatives, and tasks. Load when running `taskman` commands (create-plan,
  create-handoff, status, list, update-task, add-task, reconcile, close),
  tracking plan/task progress across sessions or harnesses, or calling
  @dreki-gg/taskman as a library. Covers the status-is-a-projection model,
  stateless plan resolution, and reconcile.
type: core
library: "@dreki-gg/taskman"
library_version: "0.4.0"
sources:
  - "dreki-gg/pi-extensions:packages/taskman/README.md"
  - "dreki-gg/pi-extensions:packages/taskman/src/cli.ts"
  - "dreki-gg/pi-extensions:packages/taskman/src/engine.ts"
---

# taskman

`taskman` manages plan/task state on disk under `.plans/` so planning agents
keep durable progress across sessions and tools. It ships both a CLI (`taskman`)
and a library (`@dreki-gg/taskman`).

The command and flag inventory is **not** reproduced here — it lives in
`--help`, which is always current for the installed version:

```bash
taskman --help            # all commands
taskman <command> --help  # flags + arguments for one command
```

This skill teaches the model that `--help` cannot: the data contract and the
three invariants that decide whether a command does what you expect.

## The ledger

Everything is plain JSONL/Markdown under `.plans/` in the current directory:

- `.plans/plans.jsonl` — plan registry
- `.plans/initiatives.jsonl` — initiative registry (initiatives group plans)
- `.plans/<plan>/tasks.jsonl` — one plan's tasks (first line is metadata)
- `.plans/<plan>/HANDOFF.md`, `.plans/<initiative>/INITIATIVE.md` — prose

## Invariants (read before acting)

1. **Status is a projection of task state, not a manual flag.** A plan becomes
   `done` when its active tasks are all resolved and no follow-ups remain; an
   initiative becomes `done` when every member plan is terminal. `update-task`
   re-derives the registry automatically.
2. **Plan resolution is stateless.** A command targets a plan via `--plan
   <name>` (accepts `.plans/<name>`), else the *single* in-progress plan.
   Ambiguous or missing → non-zero exit listing the candidates.
3. **Manual terminal statuses are never auto-reverted.** `reconcile` only moves
   `in-progress ⇄ done`; it never resurrects a `superseded`/`abandoned` plan or
   regresses a finished one.

## Core Patterns

### Execution loop

```bash
taskman status                  # active plan + task ids/statuses
taskman update-task t-003 done  # mark progress; plan status re-derived
taskman add-task "handle empty input" --reason "found gap while implementing"
taskman reconcile --apply       # repair safe (in-progress→done) drift
```

### Creating plans from any harness

Plans don't have to originate in plan-mode's `submit_plan` tool. The CLI creates
the same durable artifacts (tasks.jsonl + HANDOFF.md + registry entry) so a
foreign harness can seed the ledger directly. Handoff/task payloads accept an
inline value, a `--*-file <path>`, or piped stdin.

```bash
echo "$MARKDOWN" | taskman create-plan --name my-plan --title "My Plan" \
  --handoff-file - --tasks '[{"description":"do it"}]'   # tasks get t-NNN ids
taskman create-handoff --plan my-plan --file HANDOFF.md   # write/replace prose
```

Use `--initiative <name>` to link the plan (create the initiative first) and
`--depends-on a,b` for plan-level ordering. Task creation here is plan setup —
distinct from `add-task`, which records a *deferred* follow-up (see below).

### Machine-readable output

Every command prints human text by default and accepts `--json`:

```bash
taskman status --json   # { active, plan_name, title, total, counts, task_ids }
taskman list --json     # array of plan items
```

### Library usage

```ts
import { makePlanRuntime, resolvePlanByName, setTaskStatus } from '@dreki-gg/taskman';

const run = makePlanRuntime(); // bridges Effect programs to the live filesystem
const { planName, planDir, candidates } = await run(resolvePlanByName({ name: 'my-plan' }));
if (!planDir) throw new Error(`Unresolved; candidates: ${candidates.join(', ')}`);
await run(setTaskStatus(planDir, 't-001', 'done')); // also reconciles the registry
```

## Common Mistakes

### HIGH Setting plan status by hand to mark progress

Wrong:

```bash
taskman close done --plan my-plan   # to "finish" a plan whose tasks are open
```

Correct:

```bash
taskman update-task t-007 done      # resolve the tasks; status follows
```

`close` forces a lifecycle status and is for `superseded`/`abandoned` (or an
explicit override). For normal completion, resolve the tasks — the `done`
projection is derived from task state, so a forced `done` will be re-opened the
moment another task write reconciles the plan.

### HIGH Assuming a bare command finds any plan

Wrong:

```bash
taskman status   # expecting it to pick "the plan I just finished"
```

Correct:

```bash
taskman status --plan my-plan   # name it explicitly when not uniquely in-progress
```

With no `--plan`, resolution only succeeds when exactly one plan is
`in-progress`. A just-completed plan is `done`, so it drops out of resolution
and a bare command exits non-zero — pass `--plan`.

### MEDIUM Treating reconcile as a force-sync in both directions

Wrong:

```bash
taskman reconcile --apply   # expecting it to flip a done plan back to in-progress
```

Correct:

```bash
# A `done` plan with unfinished tasks is reported as downgrade drift, NOT fixed.
# Resolve it by marking the tasks instead:
taskman update-task t-004 done --plan my-plan
```

`reconcile --apply` only performs the safe upgrade (`in-progress → done`). A
`done`→`in-progress` downgrade almost always means work merged without marking
tasks; it is surfaced for a human, never auto-applied.

### MEDIUM Expecting add-task to queue active work

Wrong:

```bash
taskman add-task "refactor parser" --reason "messy"
# ...then expecting it to show as pending work to do now
```

Correct:

```bash
taskman add-task "refactor parser" --reason "messy"   # captured as a deferred follow-up
# Review/triage later; it is intentionally kept out of the active queue and
# keeps the plan non-finalizable until resolved.
```

`add-task` records a `deferred`, `discovered` task — a follow-up for later
triage, not an active to-do. It does not become pending automatically.
