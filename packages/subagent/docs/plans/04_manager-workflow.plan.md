---
name: "Manager workflow for multi-slice delegation"
overview: "Add a bundled `manager` role and a reusable manager workflow so `@dreki-gg/pi-subagent` can coordinate larger, multi-slice tasks without turning into an unstructured swarm. The manager should split work, delegate bounded child tasks, synthesize discoveries, and keep writes coherent."
todo:
  - id: "manager-workflow-1"
    task: "Add a bundled `manager` agent with a narrow orchestration role, explicit child-report contract, and no multi-writer default"
    status: pending
  - id: "manager-workflow-2"
    task: "Add a bundled prompt template that invokes the manager for larger features or migrations"
    status: pending
  - id: "manager-workflow-3"
    task: "Expose the new manager role in package docs and examples without overpromising unstructured swarm behavior"
    status: pending
---

# Goal

Introduce a first-class manager workflow that can decompose larger tasks into bounded child-agent workstreams, synthesize the results, and keep decision-making coherent.

# Context

- Parent rationale: the package already has strong primitives (`single`, `parallel`, `chain`), but not a clear higher-level delegation pattern for “a feature spanning several slices” or “a migration with multiple child tasks.”
- Module root: `packages/subagent`
- This slice should stay opinionated: map / reduce / manage, not arbitrary peer-to-peer swarms.
- The manager should be useful even if no new runtime code is added. Prefer prompt + workflow packaging first.

## What exists

Current relevant file tree on disk:

- `packages/subagent/agents/scout.md`
- `packages/subagent/agents/docs-scout.md`
- `packages/subagent/agents/planner.md`
- `packages/subagent/agents/worker.md`
- `packages/subagent/agents/reviewer.md`
- `packages/subagent/prompts/implement.md`
- `packages/subagent/prompts/scout-and-plan.md`
- `packages/subagent/prompts/implement-and-review.md`
- `packages/subagent/README.md`
- `packages/subagent/extensions/subagent/index.ts`
- `packages/subagent/extensions/subagent/agent-runner.ts`
- `packages/subagent/extensions/subagent/agents.ts`
- `packages/subagent/skills/spawn-subagents/SKILL.md`
- `packages/subagent/skills/write-an-agent/SKILL.md`

Actual current state on disk:

- The package ships six bundled agents today: `scout`, `docs-scout`, `planner`, `worker`, `reviewer`, and `ux-designer` (`packages/subagent/README.md:88-105`). There is no `manager` agent.
- The package ships three prompt templates today: `/implement`, `/scout-and-plan`, and `/implement-and-review` (`README.md:121-124`). There is no manager-oriented workflow prompt.
- The `subagent` tool supports only three orchestration modes:
  - single
  - parallel
  - chain
  (`packages/subagent/extensions/subagent/index.ts:584-595` and `README.md:13-20`)
- Parallel mode is already bounded and intentionally limited:
  - max 8 tasks (`index.ts:50`, `:728-738`)
  - max concurrency 4 (`index.ts:51`, `:780-805`)
- The `spawn-subagents` skill already encodes the package’s desired shape:
  - parallel recon
  - plan then implement
  - review loop
  - “Parallelize reconnaissance, not conflicting edits” (`SKILL.md:31-58`)
  But there is no equivalent section for higher-level “manager delegates to children, then synthesizes.”
- The current agent runner logic is already compatible with a manager-style agent:
  - `runSingleAgent()` in `index.ts:325-328` only passes `--tools` when the agent frontmatter declares a tool list.
  - `runAgent()` in `agent-runner.ts:73-76` behaves the same way.
  - This means a new `manager` agent can omit `tools:` in frontmatter if it needs access to the full tool set, including the `subagent` tool itself.
- There is no project-local `.pi/agents/*.md` manager override in this repo right now; `.pi/agents/` exists but is empty.

# API inventory

## Existing agent frontmatter model

From `packages/subagent/extensions/subagent/agents.ts`:

```ts
export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  thinking?: string;
  sessionStrategy?: 'inline' | 'fork-at';
  systemPrompt: string;
  source: 'bundled' | 'user' | 'project' | 'package';
  filePath: string;
}
```

From `packages/subagent/README.md`:

```md
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: anthropic/claude-haiku-4-5
sessionStrategy: fork-at
---
```

## Existing subagent tool modes the manager will likely use

From `packages/subagent/README.md` and `packages/subagent/extensions/subagent/index.ts`:

```ts
// Single
{ agent, task }

// Parallel
{ tasks: [{ agent, task }, ...] }

// Chain
{ chain: [{ agent, task }, ...] }
```

## Existing agent roles the manager should compose, not replace

- `scout` — repo reconnaissance
- `docs-scout` — docs lookup
- `planner` — implementation planning
- `worker` — implementation
- `reviewer` — verification

The manager should orchestrate these roles, not absorb them.

## Proposed manager output contract

Create a prompt contract that is directly usable by the main agent or a human:

```md
## Goal
- one-sentence statement of the parent task

## Workstreams
1. Workstream name — owner agent, scope, expected output
2. ...

## Shared Decisions
- constraints all children must follow

## Child Reports
### <workstream>
- what was learned / produced
- files implicated
- blockers or open questions

## Recommended Next Action
- whether to run worker, reviewer, or ask the human
```

# Tasks

## 1. Add a bundled `manager` agent with a narrow orchestration role

### Files
- Create `packages/subagent/agents/manager.md`

### What to add
Author a concise bundled agent prompt that:
- decomposes a larger task into bounded child workstreams
- delegates to child agents via the `subagent` tool when beneficial
- prefers read-only discovery or planning in parallel
- keeps implementation coherent by limiting writing to one `worker` at a time unless file ownership is truly partitioned
- synthesizes child output into a structured manager report

### Frontmatter guidance
- Omit `tools:` in the first implementation unless you confirm that explicitly listing `subagent` is supported end-to-end in spawned agent tool selection.
- Use an existing strong model already present in the package (for example `openai/gpt-5.4`) rather than introducing a new provider requirement in this slice.
- Keep the file under ~100 lines, following `packages/subagent/skills/write-an-agent/SKILL.md`.

### Required prompt rules
1. Split work by scope, not by arbitrary agent count.
2. Prefer `scout` / `docs-scout` / `planner` in parallel for discovery.
3. Prefer a single `worker` for edits unless file ownership is obviously isolated.
4. Synthesize child findings before asking for more work.
5. Escalate open product or architecture decisions back to the main agent / user instead of hallucinating consensus.

## 2. Add a bundled prompt template that invokes the manager for larger tasks

### Files
- Create `packages/subagent/prompts/manage.md`

### What to add
Add a prompt template for larger tasks such as migrations, multi-package refactors, or features that need several child investigations.

### Suggested prompt shape

```md
Use the subagent tool to run the `manager` agent on: $@

The manager should:
1. break the work into bounded child workstreams
2. use parallel scouts/planners where helpful
3. keep implementation single-writer by default
4. return a synthesized report with recommended next steps
```

### Notes
- Do not build an unbounded recursive swarm prompt.
- The manager prompt should feel like a higher-level entry point, not a new runtime mode.

## 3. Expose the new manager role in docs and examples

### Files
- Modify `packages/subagent/README.md`
- Modify `packages/subagent/skills/spawn-subagents/SKILL.md`

### What to change
- Add `manager` to the bundled agent list in the README.
- Add one example showing when to use it, such as a multi-package migration or a feature spanning several child tasks.
- Extend the `spawn-subagents` skill with a new “Manager pattern” section that explains:
  - when to use a manager
  - how it should delegate
  - why this is different from a generic swarm

### Suggested skill wording targets
- “Use `manager` when the task is too large for one prompt but still needs coherent decisions.”
- “Managers split work, children investigate or implement bounded slices, the manager synthesizes.”
- “Do not create arbitrary peer-to-peer negotiation loops.”

# Files to create

- `packages/subagent/agents/manager.md`
- `packages/subagent/prompts/manage.md`

# Files to modify

- `packages/subagent/README.md` — add manager to bundled agents and prompt templates, plus one usage example
- `packages/subagent/skills/spawn-subagents/SKILL.md` — add manager orchestration guidance

# Testing notes

- If the manager prompt remains markdown-only, there is no package typecheck requirement.
- Manually run a small `/run-agent manager ...` or equivalent `subagent` call and confirm the manager:
  - breaks work into bounded tasks
  - uses parallel recon rather than parallel conflicting edits
  - returns a synthesized report instead of dumping raw child logs
- If you decide to add any helper TS module to support manager summaries, run `bun run --filter '@dreki-gg/pi-subagent' typecheck`.
- Keep the manager role useful without assuming any future advisor/handoff feature exists.

# Patterns to follow

- `packages/subagent/skills/spawn-subagents/SKILL.md:31-58` — existing orchestration philosophy to extend upward
- `packages/subagent/skills/write-an-agent/SKILL.md:15-20` and `:46-67` — agent-authoring constraints for concise, high-signal prompts
- `packages/subagent/agents/planner.md:9-38` — good example of a narrow role with a clear output contract
- `packages/subagent/agents/worker.md:9-26` — example of a task-focused executor the manager should call, not replace
- `packages/subagent/README.md:88-124` — bundled-agent and bundled-prompt sections to update
