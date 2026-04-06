---
name: subagent-workflows
description: Use explicit subagent workflows for planning or implementation after a grill/design session. Runs parallel scouts, then planner, then optional worker/reviewer.
---

Use this skill when the user wants to execute a plan with subagents, parallelize discovery intelligently, or asks to hand work off after a design/grill session.

Principles:
- Use the `subagent` tool explicitly; do not improvise ad hoc parallelism.
- Parallelize reconnaissance, not conflicting edits.
- Prefer one planner synthesis step after parallel scouts.
- Prefer one worker unless file ownership can be partitioned safely.
- Use `docs-scout` whenever library/framework docs matter.

Recommended workflows:

## 1. Scout and plan
Use when the user wants a concrete implementation plan before coding.

Run `subagent` in parallel mode with two tasks:
- `scout` for codebase reconnaissance
- `docs-scout` for library/framework docs if docs are relevant

Then run `subagent` in chain or single mode with `planner`, feeding it the scout outputs.

## 2. Implement from a grilled plan
Use when the design is already clarified and the user wants execution.

Recommended sequence:
1. Parallel scouts (`scout` + optionally `docs-scout`)
2. `planner` synthesis
3. `worker` implementation
4. Optional `reviewer`

## 3. Review-oriented loop
Use when the user wants implementation with a final quality pass.

Recommended sequence:
1. `worker`
2. `reviewer`
3. Main agent decides whether to apply fixes directly or run another `worker`

Execution guidance:
- Keep parallel scouts focused on different concerns.
- Do not run multiple workers against the same file set unless boundaries are explicit.
- If docs are required, use `docs-scout` instead of relying on memory.
- When handing off between subagents, pass the previous output verbatim or clearly summarized.

When reporting back to the user:
- Say which subagents ran
- Summarize what each contributed
- Present the synthesized plan or implementation result clearly
