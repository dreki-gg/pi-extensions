# Orchestration Principles

`@dreki-gg/pi-subagent` is an opinionated orchestration package.

Its default operating model is simple: use extra agents to improve reconnaissance, planning, and review, while keeping implementation coherent under one writer unless ownership is clearly partitioned.

## Default philosophy

- Prefer **one writer, many thinkers**.
- Use **parallel mode for discovery**, not for competing edits.
- Use **chain mode for safe sequential handoffs** between scout, planner, worker, and reviewer.
- Treat `reviewer` as a **fresh-context verifier**, not as a second implementation agent.
- Reach for subagents to reduce context rot and sharpen conclusions, not to create an arbitrary swarm.

## When to use each mode

### `single`

Use `single` when one specialist can do the job.

Good fits:
- `scout` tracing a code path
- `docs-scout` checking framework or library docs
- `planner` producing a focused implementation plan
- `worker` implementing a bounded change
- `reviewer` performing a focused review
- `validator` confirming or falsifying a specific bug claim
- `bug-prover` creating a minimal failing repro when proof needs a new artifact

### `parallel`

Use `parallel` when tasks are read-heavy, independent, and easy to synthesize.

Good fits:
- `scout` + `docs-scout` gathering code and docs context at the same time
- two scouts inspecting different subsystems
- multiple reviewers checking different bounded concerns

Avoid `parallel` when two agents would edit the same files, make overlapping design decisions, or race to implement the same slice.

### `chain`

Use `chain` when a task benefits from ordered handoffs.

Good fits:
- discovery before planning
- planning before implementation
- implementation before review
- review findings before a final fix pass

Prefer compact handoffs and summaries over long transcript dumps.

## Recommended workflows

### Scout → planner → worker

Use this when the task is unclear or spans multiple files.

- `scout` identifies relevant code, constraints, and touched files
- `planner` turns that into a concrete implementation path
- `worker` executes with a coherent plan

### Worker → reviewer → validator / bug-prover → worker

Use this when you want fresh-context verification before returning a result and some review claims need proof.

- `worker` makes the change
- `reviewer` checks the diff and code with a fresh lens
- `validator` confirms uncertain claims from commands, existing tests, and code
- `bug-prover` creates the smallest failing repro only when proof needs a new artifact
- `worker` applies concrete, scoped fixes after claims are evidenced

### Scout + docs-scout in parallel

Use this when both repository context and external documentation matter.

- `scout` inspects the local codebase
- `docs-scout` checks framework, library, or API docs
- the main thread synthesizes both into one next action

## Non-goals

This package is not trying to optimize for:

- arbitrary agent swarms
- multi-writer editing without clear file ownership
- speculative parallel implementations of the same task
- using subagents as a substitute for coherent architecture decisions
- pushing raw agent logs back into the main thread as the primary artifact

## Examples

### Single specialist

```text
/run-agent scout trace how auth state is loaded
```

### Parallel recon

```ts
subagent({
  tasks: [
    { agent: "scout", task: "Trace how auth state is loaded" },
    { agent: "docs-scout", task: "Check the latest auth library session refresh docs" },
  ],
})
```

### Plan then implement

```ts
subagent({
  chain: [
    { agent: "scout", task: "Find all code relevant to auth session refresh" },
    { agent: "planner", task: "Create an implementation plan for auth session refresh using {previous} as the handoff" },
    { agent: "worker", task: "Implement the auth session refresh plan from {previous}" },
  ],
})
```

### Implement and review

```ts
subagent({
  chain: [
    { agent: "worker", task: "Implement questionnaire validation improvements" },
    { agent: "reviewer", task: "Review the diff using {previous} as a compact handoff" },
    { agent: "worker", task: "Address concrete findings from {previous}" },
  ],
})
```
