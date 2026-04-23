---
name: "Parallel recon, single-writer docs refresh"
overview: "Document `@dreki-gg/pi-subagent` as an opinionated orchestration tool for parallel reconnaissance, planning, and review around a single writer. This slice updates the package docs and skill guidance without introducing new runtime behavior."
todo:
  - id: "docs-refresh-1"
    task: "Add a package-local orchestration principles doc that explains when to use single, parallel, and chain modes—and when not to"
    status: pending
  - id: "docs-refresh-2"
    task: "Update the package README so one-writer guidance appears near the top instead of being implied"
    status: pending
  - id: "docs-refresh-3"
    task: "Tighten the spawn-subagents skill and bundled prompt descriptions so they consistently recommend parallel recon, not parallel conflicting edits"
    status: pending
---

# Goal

Make the package documentation explicitly teach the operating model we want users and orchestrating agents to follow: parallelize discovery and verification, keep writes coherent, and use fresh-context reviewers instead of swarms of editors.

# Context

- Parent rationale: the current package direction is already mostly right; the docs should make that philosophy unmistakable.
- Module root: `packages/subagent`
- This is a docs-and-guidance slice. It should not depend on runtime changes landing first.
- Prefer package-local docs because the repo already stores package-specific plans under package-local `docs/` trees (for example `packages/browser-tools/docs/plans/`).

## What exists

Current relevant file tree on disk:

- `packages/subagent/README.md`
- `packages/subagent/skills/spawn-subagents/SKILL.md`
- `packages/subagent/prompts/implement.md`
- `packages/subagent/prompts/scout-and-plan.md`
- `packages/subagent/prompts/implement-and-review.md`
- `packages/subagent/agents/scout.md`
- `packages/subagent/agents/planner.md`
- `packages/subagent/agents/reviewer.md`
- `packages/subagent/agents/worker.md`
- `packages/subagent/package.json`
- `packages/subagent/CHANGELOG.md`

Actual current state on disk:

- `packages/subagent/README.md` explains the three tool modes and the bundled agents, but it does not prominently state a philosophy like “parallel readers, single writer” or “use review loops over swarms.” The first sections are mode descriptions and examples (`README.md:11-45`).
- The README does list examples that already imply sensible usage—scout, planner, worker, reviewer—but it stops short of explicitly warning against conflicting parallel edits (`README.md:21-45`).
- The `spawn-subagents` skill is already the clearest articulation of current best practice:
  - `Single specialist` (`SKILL.md:23-29`)
  - `Parallel recon` (`SKILL.md:31-35`)
  - `Plan then implement` (`SKILL.md:37-42`)
  - `Review loop` (`SKILL.md:44-47`)
  - execution rules that say “Parallelize reconnaissance, not conflicting edits” and “Prefer one worker unless file ownership is clearly partitioned” (`SKILL.md:49-53`)
- The prompt templates are short and functional, but their descriptions do not advertise the package’s opinionated orchestration stance:
  - `/implement` is “Full implementation workflow” (`packages/subagent/prompts/implement.md:1-10`)
  - `/scout-and-plan` is “Scout gathers context, planner creates implementation plan” (`packages/subagent/prompts/scout-and-plan.md:1-9`)
  - `/implement-and-review` is “Worker implements, reviewer reviews, worker applies feedback” (`packages/subagent/prompts/implement-and-review.md:1-10`)
- There is currently no `packages/subagent/docs/` directory other than the plans we are now adding.

# API inventory

## User-facing package surface documented today

From `packages/subagent/README.md`:

```md
## Subagent Tool

The `subagent` tool supports three modes:

| Mode | Description |
| Single | `{ agent, task }` — one agent, one task |
| Parallel | `{ tasks: [...] }` — multiple agents concurrently |
| Chain | `{ chain: [...] }` — sequential with `{previous}` placeholder |
```

```md
### Bundled Agents
- `scout` — fast codebase recon
- `docs-scout` — Context7-first documentation lookup
- `planner` — implementation planning
- `worker` — general-purpose implementation (`sessionStrategy: fork-at` by default)
- `reviewer` — code review (`sessionStrategy: fork-at` by default)
- `ux-designer` — frontend UI design
```

## Current skill guidance to preserve and elevate

From `packages/subagent/skills/spawn-subagents/SKILL.md`:

```md
## 2. Parallel recon
- Run `scout` + `docs-scout` in parallel when both code and docs matter.
- Keep parallel tasks non-overlapping.
- Return a compact synthesis to the main thread.

Execution rules:
- Parallelize reconnaissance, not conflicting edits.
- Prefer one `worker` unless file ownership is clearly partitioned.
- Use `docs-scout` when external library/framework details matter.
- Pass previous outputs verbatim or as a tight structured summary.
```

These lines are the core behavioral contract the docs refresh should reinforce.

# Tasks

## 1. Add a package-local orchestration principles doc

### Files
- Create `packages/subagent/docs/orchestration-principles.md`

### What to add
Create a short, high-signal doc that explains the intended operating model of `@dreki-gg/pi-subagent`.

### Required sections
- `## Default philosophy`
  - single writer, many thinkers
  - parallel recon yes / conflicting edits no
- `## When to use each mode`
  - `single`
  - `parallel`
  - `chain`
- `## Recommended workflows`
  - scout → planner → worker
  - worker → reviewer → worker
  - scout + docs-scout in parallel
- `## Non-goals`
  - arbitrary swarms
  - multi-writer editing without clear ownership
  - using subagents as a substitute for coherent architecture decisions
- `## Examples`
  - concise examples mirroring current prompt templates and skill guidance

### Notes
- Keep it grounded in features that exist today.
- Do not document manager/advisor agents here unless they actually ship before this slice lands.

## 2. Update the package README so one-writer guidance appears near the top

### Files
- Modify `packages/subagent/README.md`

### What to change
- Add an “Opinionated defaults” or “How to think about this package” section immediately after the mode table.
- Make these points explicit:
  - `parallel` is best for scouts and other read-only discovery agents
  - `chain` is best when a single writer needs planned, sequential help
  - `reviewer` is a verifier, not a second writer
  - default safe pattern is one writer unless file ownership is clearly partitioned
- Keep existing install/use examples, but rewrite at least one example block to show the philosophy in practice.

### Suggested wording targets
- “Use parallel mode for discovery, not competing edits.”
- “Prefer one worker and surround it with scouts, planners, and reviewers.”
- “Use review loops to inject fresh context before a human or main agent reads the result.”

## 3. Tighten the `spawn-subagents` skill and prompt descriptions

### Files
- Modify `packages/subagent/skills/spawn-subagents/SKILL.md`
- Modify `packages/subagent/prompts/implement.md`
- Modify `packages/subagent/prompts/scout-and-plan.md`
- Modify `packages/subagent/prompts/implement-and-review.md`

### What to change
- Keep the skill concise, but move the “parallel recon, not conflicting edits” principle earlier or phrase it more strongly.
- Make the prompt descriptions more self-explanatory:
  - `/implement` should read as a safe sequential workflow around one implementing agent.
  - `/scout-and-plan` should read as a recon + planning workflow, not a half-implemented swarm.
  - `/implement-and-review` should read as a generator-verifier loop.
- If any prompt template still implies that `{previous}` is just an unbounded transcript, rewrite the wording to say “handoff” / “summary” instead.

# Files to create

- `packages/subagent/docs/orchestration-principles.md`

# Files to modify

- `packages/subagent/README.md` — make package philosophy explicit near the top
- `packages/subagent/skills/spawn-subagents/SKILL.md` — strengthen the opinionated orchestration guidance
- `packages/subagent/prompts/implement.md` — clarify this is a sequential one-writer workflow
- `packages/subagent/prompts/scout-and-plan.md` — clarify this is recon + planning, not implementation
- `packages/subagent/prompts/implement-and-review.md` — describe the workflow as a generator-verifier loop

# Testing notes

- This slice is markdown-only unless you also tweak package metadata, so there is no TypeScript typecheck requirement.
- Manually read the final README and skill files in one pass to make sure they do not contradict each other.
- Keep examples aligned with currently shipped agents and prompts.
- If a later feature slice adds manager/advisor agents before this one lands, update the new principles doc in the same branch rather than documenting speculative agents now.

# Patterns to follow

- `packages/subagent/skills/spawn-subagents/SKILL.md:21-58` — current best articulation of package operating rules
- `packages/subagent/README.md:11-45` — current package intro to improve, not replace wholesale
- `packages/subagent/prompts/implement.md:1-10` — terse prompt-template style to preserve
- `packages/subagent/prompts/scout-and-plan.md:1-9` — terse prompt-template style to preserve
- `packages/subagent/prompts/implement-and-review.md:1-10` — terse prompt-template style to preserve
- `packages/browser-tools/docs/plans/*.plan.md` — package-local docs/plans organization pattern already used elsewhere in the repo
