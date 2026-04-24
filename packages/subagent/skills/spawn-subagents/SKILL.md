---
name: spawn-subagents
description: Use conversational subagent orchestration with the `subagent` tool. Trigger when the user says spawn, spin up, fan out, parallelize, send to reviewer, use scout/planner/worker, or wants specialized agents to investigate, plan, implement, or review.
---

Use this skill when the user wants agents spawned conversationally.

Core rule:
- Parallelize discovery and verification, not conflicting edits.
- Prefer one `worker` unless file ownership is clearly partitioned.

Default behavior:
- Prefer the `subagent` tool directly.
- Use `/run-agent` only when the user explicitly wants a direct named-agent run.
- This package is agent-first: build the needed `single` / `parallel` / `chain` orchestration directly instead of reaching for canned workflow prompts.

Strong triggers:
- "spawn a scout"
- "fan this out"
- "run reviewer on this"
- "have planner make a plan first"
- "send docs-scout to check the docs"
- "parallelize discovery"
- "coordinate this migration"
- "break this feature into child workstreams"
- "ask advisor for a second opinion on this"
- "validate whether this review finding is real"
- "prove this bug with a minimal failing test"

Patterns:

## 1. Single specialist
Use one agent when the task is narrow.
- `scout` for repo reconnaissance
- `docs-scout` for docs lookup
- `planner` for a concrete plan
- `worker` for implementation
- `reviewer` for quality/security review
- `validator` to confirm or falsify a specific bug or behavior claim
- `bug-prover` to create the smallest failing repro when a claim needs proof
- `advisor` for a focused second opinion on a tricky or high-risk decision

## 2. Parallel recon
Use parallel mode for noisy discovery, not implementation races.
- Run `scout` + `docs-scout` in parallel when both code and docs matter.
- Keep parallel tasks non-overlapping.
- Return a compact synthesis to the main thread.

## 3. Plan then implement
Use chain mode when the user wants safe sequencing around one implementing agent.
1. `scout` and optionally `docs-scout`
2. `planner`
3. `worker`
4. optional `reviewer`

## 4. Review loop
Use after implementation or when the user asks for a second opinion.
1. `reviewer` inspects the diff and code
2. if a suspected issue needs evidence, run `validator`
3. if proof still needs a minimal failing test or repro artifact, run `bug-prover`
4. only send confirmed, evidenced findings back to `worker`

## 5. Manager pattern
Use `manager` when the task is too large for one prompt but still needs coherent decisions.
1. `manager` splits the work into bounded workstreams
2. `manager` runs `scout`, `docs-scout`, or `planner` in parallel when discovery can be split cleanly
3. `manager` keeps implementation single-writer by default, handing edits to one `worker` unless ownership is clearly partitioned
4. `manager` synthesizes child reports before recommending the next action

Good fits:
- multi-package migrations
- larger refactors with several discovery threads
- features spanning backend, UI, and docs that still need shared decisions

## 6. Claim validation and proof
Use `validator` and `bug-prover` when review claims should be evidenced before they become fix requests.

Good fits:
- reviewer suspects a regression but needs command/test evidence
- worker wants to confirm whether an edge case is truly broken
- a bug claim seems plausible but not yet proven from diff/code alone
- you want a minimal failing test before authorizing a fix

Flow:
- `validator` first for read-only verification with code, tests, and focused commands
- `bug-prover` only when proof needs a new failing test or isolated repro artifact
- keep repro scope narrow; proving is not fixing

## 7. Targeted advisor consult
Use `advisor` when the primary owner is still clear, but a tricky question needs a strong second opinion.

Good fits:
- planner is choosing between multiple designs with different blast radius
- worker is stuck in a failing test loop or messy migration
- reviewer is unsure whether a suspected issue is real, intended, or severe
- the change is security-sensitive or otherwise high risk

Consult packet:
- current role (`worker`, `planner`, `reviewer`, or `main-agent`)
- exact question to answer
- smallest relevant task summary
- touched files or symbols, if known
- what has already been tried, verified, or observed

Rules:
- advisor use is optional, not a default step
- keep the primary role in charge of the final plan, implementation, or review judgment
- prefer one clear advisor recommendation over a long brainstorm

Avoid:
- arbitrary peer-to-peer negotiation loops
- unbounded swarms
- multiple workers editing overlapping files
- calling `advisor` when `planner` or `reviewer` already has enough signal to proceed alone
- sending speculative review findings back for fixes before they are validated when evidence is needed

Execution rules:
- Use `manager` when the task is too large for one prompt but still needs coherent decisions.
- Use `advisor` for targeted second opinions on tricky or high-risk cases.
- Use `validator` to confirm a claim before escalating it as a fix.
- Use `bug-prover` only when confirmation needs a minimal failing test or repro artifact.
- Parallelize reconnaissance and verification, not conflicting edits.
- Prefer one `worker` unless file ownership is clearly partitioned.
- Use `docs-scout` when external library/framework details matter.
- Pass a compact handoff or structured summary via `{previous}`, not an unbounded transcript dump.

When reporting back:
- say which subagents ran
- summarize what each contributed
- keep the main thread focused on conclusions, not raw logs
