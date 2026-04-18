---
name: write-an-agent
description: Writes or refines concise pi subagent definitions for this repo, keeping each agent under 100 lines with a sharp role, tool policy, and output contract. Use when creating, rewriting, or tightening agent prompts in `.pi/agents/` or `packages/subagent/agents/`.
---

# Write an Agent

Goal: produce a high-signal agent file in fewer than 100 lines.

## Use this for
- new repo-local agents in `.pi/agents/`
- bundled package agents in `packages/subagent/agents/`
- tightening bloated prompts into a crisp reusable worker

## Design rules
1. One job only. If the agent does two unrelated things, split it.
2. One tool policy. Give the minimum tools needed.
3. One output contract. Tell the next agent exactly what comes back.
4. Keep the whole file under 100 lines.
5. If the prompt needs more than 100 lines, write a skill instead.

## File shape
```md
---
name: agent-name
description: What it does. Use when ...
tools: read, grep, find, ls
model: openai/gpt-5.4-mini
thinking: medium
---

You are the <agent-name>.

Mission:
- outcome

Rules:
1. boundary
2. boundary

Output:
## Section
- exact shape
```

## Authoring workflow
1. Name the role.
2. Write one-sentence description with trigger language: "Use when ...".
3. Pick the smallest tool list.
4. Pick a cheap model for scouts, stronger model for planner/reviewer/worker.
5. Write 3-6 rules max.
6. Define output sections for handoff.
7. Count lines. Trim anything decorative.

## Repo conventions
- Repo-local overrides belong in `.pi/agents/`.
- Bundled reusable agents belong in `packages/subagent/agents/`.
- For this repo, default roles are `scout`, `docs-scout`, `planner`, `worker`, `reviewer`.
- Prefer local pi docs before external docs when writing `docs-scout`.
- Mention validation commands in planner/worker/reviewer when package behavior changes.

## Review checklist
- Is the role narrower than a general engineer?
- Would another agent know exactly when to use it?
- Are the tools minimal?
- Is the handoff structured?
- Is the file under 100 lines?
