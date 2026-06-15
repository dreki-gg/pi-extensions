# @dreki-gg/taskman

A standalone task-management engine — and a `taskman` CLI — over a plain
`.plans/` JSONL ledger. It is the core extracted from
[`@dreki-gg/pi-plan-mode`](../plan-mode), so any harness (not just pi) can drive
the same plans, initiatives, and tasks.

## Why it exists

Planning agents need durable, file-based task state that survives across
sessions and tools. `taskman` owns that state machine — task status, plan and
initiative lifecycle, and the projection rules that keep them consistent — with
**no dependency on any specific agent harness**. Use it from a shell, a CI job,
a different agent, or as a library.

## The ledger (the one durable contract)

Everything lives under `.plans/` in the current working directory:

- `.plans/plans.jsonl` — the plan registry.
- `.plans/initiatives.jsonl` — the initiative registry (initiatives group plans).
- `.plans/<plan>/tasks.jsonl` — one plan's task list (first line is metadata).
- `.plans/<plan>/HANDOFF.md`, `.plans/<initiative>/INITIATIVE.md` — prose docs.

Three invariants are worth knowing; everything else is mechanism:

1. **Status is a projection, not a flag.** A plan is `done` when its active
   tasks are all resolved (and no follow-ups remain); an initiative is `done`
   when every member plan is terminal. Writing task state re-derives the
   registry — you do not set plan status by hand for the normal path.
2. **Plan resolution is stateless.** A command targets a plan via `--plan
   <name>` (accepts `.plans/<name>` too), else the *single* in-progress plan.
   Ambiguous or missing → it exits non-zero and lists the candidates.
3. **Terminal statuses set manually are never auto-reverted.** `reconcile` only
   moves `in-progress ⇄ done`; it never resurrects a `superseded`/`abandoned`
   plan or regresses a finished one.

## Usage

```bash
taskman --help            # full, always-current command list
taskman <command> --help  # flags + arguments for one command
```

`--help` is the source of truth for commands and flags — this README does not
duplicate it (so it cannot drift). Every command prints human text by default
and accepts `--json` for machine consumption.

A typical execution loop:

```bash
taskman status                       # what's the active plan and its tasks?
taskman update-task t-003 done       # mark progress (auto-reconciles the plan)
taskman add-task "handle empty case" --reason "found gap while implementing"
taskman reconcile --apply            # repair safe status drift
```

## As a library

```ts
import { makePlanRuntime, resolvePlanByName, setTaskStatus } from '@dreki-gg/taskman';

const run = makePlanRuntime(); // bridges the Effect programs to the live filesystem
const { planDir } = await run(resolvePlanByName({ name: 'my-plan' }));
await run(setTaskStatus(planDir!, 't-001', 'done'));
```

The public surface (storage, schema, reconcile, initiative projection,
resolution, and composite write flows) is exported from the package root. The
engine is built on [Effect](https://effect.website) with a single `FileSystem`
seam, so it is straightforward to test and to run against an alternate backend.

## Agent skill

This package ships a [TanStack Intent](https://tanstack.com/intent) skill
(`skills/taskman/core`) — versioned guidance that AI coding agents discover from
`node_modules`. If you use an AI agent, run:

```bash
npx @tanstack/intent@latest install
```

## License

MIT
