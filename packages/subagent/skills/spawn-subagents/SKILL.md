---
name: spawn-subagents
description: Use conversational subagent orchestration with the `subagent` tool. Trigger when the user says spawn, spin up, fan out, parallelize, send to reviewer, use scout/planner/worker, or wants specialized agents to investigate, plan, implement, or review.
---

Use this skill when the user wants agents spawned conversationally.

Default behavior:
- Prefer the `subagent` tool directly.
- Use `/run-agent` only when the user explicitly wants a direct named-agent run.
- For rigid multi-step flows, prefer the bundled prompt templates (`/implement`, `/scout-and-plan`, `/implement-and-review`) or use `subagent` chain/parallel modes directly.

Strong triggers:
- "spawn a scout"
- "fan this out"
- "run reviewer on this"
- "have planner make a plan first"
- "send docs-scout to check the docs"
- "parallelize discovery"

Patterns:

## 1. Single specialist
Use one agent when the task is narrow.
- `scout` for repo reconnaissance
- `docs-scout` for docs lookup
- `planner` for a concrete plan
- `worker` for implementation
- `reviewer` for quality/security review

## 2. Parallel recon
Use parallel mode for noisy discovery.
- Run `scout` + `docs-scout` in parallel when both code and docs matter.
- Keep parallel tasks non-overlapping.
- Return a compact synthesis to the main thread.

## 3. Plan then implement
Use chain mode when the user wants safe sequencing.
1. `scout` and optionally `docs-scout`
2. `planner`
3. `worker`
4. optional `reviewer`

## 4. Review loop
Use after implementation or when the user asks for a second opinion.
1. `reviewer`
2. main agent applies fixes directly or sends focused follow-up to `worker`

Execution rules:
- Parallelize reconnaissance, not conflicting edits.
- Prefer one `worker` unless file ownership is clearly partitioned.
- Use `docs-scout` when external library/framework details matter.
- Pass previous outputs verbatim or as a tight structured summary.

When reporting back:
- say which subagents ran
- summarize what each contributed
- keep the main thread focused on conclusions, not raw logs
