---
name: "Advisor / smart-friend routing"
overview: "Add a bundled `advisor` role and lightweight escalation guidance so strong primary agents in `@dreki-gg/pi-subagent` can ask for focused second opinions on tricky cases without turning every task into a swarm. This slice is about capability routing, not replacing the main worker."
todo:
  - id: "advisor-routing-1"
    task: "Add a bundled `advisor` agent with a focused consultative contract: diagnose, suggest next investigation, and surface risks without taking ownership of implementation"
    status: pending
  - id: "advisor-routing-2"
    task: "Teach bundled worker/planner/reviewer prompts when to call the advisor and what context to send"
    status: pending
  - id: "advisor-routing-3"
    task: "Add a reusable prompt entry point and docs examples for advisor-assisted workflows"
    status: pending
---

# Goal

Introduce a lightweight advisor pattern so primary agents can consult a strong second opinion for hard cases while keeping a single primary owner of the work.

# Context

- Parent rationale: we want capability routing and targeted escalation, not a default “everyone talks to everyone” swarm.
- Module root: `packages/subagent`
- This slice should work with the current package architecture and should not depend on a new runtime mode.
- Keep the advisor narrowly scoped: diagnose, redirect, highlight risk, or suggest the next question. The advisor should not silently become another worker.

## What exists

Current relevant file tree on disk:

- `packages/subagent/agents/planner.md`
- `packages/subagent/agents/reviewer.md`
- `packages/subagent/agents/worker.md`
- `packages/subagent/agents/docs-scout.md`
- `packages/subagent/prompts/implement.md`
- `packages/subagent/prompts/implement-and-review.md`
- `packages/subagent/README.md`
- `packages/subagent/extensions/subagent/index.ts`
- `packages/subagent/extensions/subagent/agent-runner.ts`
- `packages/subagent/skills/spawn-subagents/SKILL.md`
- `packages/subagent/skills/write-an-agent/SKILL.md`

Actual current state on disk:

- There is no bundled `advisor` agent in `packages/subagent/agents/`.
- There is no advisor-oriented prompt template in `packages/subagent/prompts/`.
- The current bundled roles are:
  - `planner` for planning (`packages/subagent/agents/planner.md`)
  - `worker` for implementation (`packages/subagent/agents/worker.md`)
  - `reviewer` for verification (`packages/subagent/agents/reviewer.md`)
  - plus `scout`, `docs-scout`, and `ux-designer`
- The package runner already supports spawned agents consulting tools as needed:
  - in `packages/subagent/extensions/subagent/index.ts:325-328`, `runSingleAgent()` passes `--tools` only when frontmatter declares them
  - in `packages/subagent/extensions/subagent/agent-runner.ts:73-76`, `runAgent()` behaves the same way
  - therefore bundled agents with omitted `tools:` can keep access to the broader tool surface, including `subagent`
- The current prompt contracts do **not** teach any role when to escalate:
  - `planner.md` only says to produce a concrete plan
  - `worker.md` only says to complete the task autonomously
  - `reviewer.md` only says to review the diff / files
- The `spawn-subagents` skill recommends specialists and review loops, but does not mention an advisor or “consult when tricky” routing rule.

# API inventory

## Existing agent prompt contracts that may invoke advisor

From `packages/subagent/agents/planner.md`:

```md
You are a planning specialist.
You must NOT make any changes. Only read, analyze, and plan.
```

From `packages/subagent/agents/worker.md`:

```md
You are a worker agent with full capabilities.
Work autonomously to complete the assigned task. Use all available tools as needed.
```

From `packages/subagent/agents/reviewer.md`:

```md
You are a senior code reviewer.
Analyze code for quality, security, and maintainability.
```

## Existing subagent entry shapes available to an advisor pattern

From the `subagent` tool surface:

```ts
// single consult
{ agent: 'advisor', task: '...' }

// consult inside a chain
{ chain: [{ agent: 'worker', task: '...' }, { agent: 'advisor', task: '... {previous} ...' }] }

// focused parallel consults
{ tasks: [{ agent: 'advisor', task: '...' }, { agent: 'docs-scout', task: '...' }] }
```

## Proposed advisor contract

The advisor should return guidance the caller can act on immediately:

```md
## Assessment
- what looks tricky / risky / ambiguous

## What to inspect next
- concrete files, commands, or questions

## Recommendation
- best next action for the caller

## Risks
- what could still go wrong
```

The advisor should not claim to have implemented or verified anything it did not actually inspect.

# Tasks

## 1. Add a bundled `advisor` agent with a focused consultative contract

### Files
- Create `packages/subagent/agents/advisor.md`

### What to add
Create a concise bundled agent whose sole job is to provide focused second-opinion guidance.

### Required behavior
- Work from the caller’s question plus any provided handoff.
- Ask the caller to investigate specific files / commands when the answer depends on context the advisor has not yet inspected.
- Surface hidden risks or better approaches.
- Avoid taking over implementation.
- Prefer decisive recommendations over brainstorming lists.

### Frontmatter guidance
- Use an existing strong model already in package conventions (default to `openai/gpt-5.4` unless there is a strong reason to diversify).
- Keep the prompt under ~100 lines per `packages/subagent/skills/write-an-agent/SKILL.md`.
- Omit `tools:` only if you want the advisor to have broad access; otherwise keep the tool list minimal and read-oriented.

### Suggested prompt rules
1. Diagnose the hard part, not the whole task from scratch.
2. If more repo context is needed, say exactly what to inspect next.
3. Return a recommendation the caller can act on immediately.
4. Do not implement code or rewrite plans unless explicitly asked.

## 2. Teach bundled prompts when to call the advisor and what context to send

### Files
- Modify `packages/subagent/agents/worker.md`
- Modify `packages/subagent/agents/planner.md`
- Modify `packages/subagent/agents/reviewer.md`

### What to change
Add small, explicit escalation rules to the existing bundled roles.

### Recommended escalation triggers
- `worker`
  - ambiguous architecture tradeoff
  - persistent failing tests or unexplained errors
  - merge conflicts / tangled diffs
  - security-sensitive or migration-heavy changes
- `planner`
  - multiple viable designs with materially different blast radius
  - unclear ownership boundaries across packages
  - need for sharper decomposition before implementation
- `reviewer`
  - uncertainty whether an issue is real vs. intended
  - suspected deeper architectural problem beyond the current diff
  - need for a second opinion on severity

### Required context to send when consulting advisor
Keep the consult lightweight:
- current role (`worker` / `planner` / `reviewer`)
- the exact question
- touched files / symbols if known
- the smallest relevant task summary
- what has already been tried or observed

### Notes
- Do not tell every role to always call the advisor. This is an escalation path, not a mandatory step.
- Keep the primary role in charge; the advisor should inform decisions, not replace ownership.

## 3. Add a reusable prompt entry point and docs examples for advisor-assisted workflows

### Files
- Create `packages/subagent/prompts/consult-advisor.md`
- Modify `packages/subagent/README.md`
- Modify `packages/subagent/skills/spawn-subagents/SKILL.md`

### What to add
Create a simple prompt template that encourages focused advisor consultation without changing core workflow semantics.

### Suggested prompt shape

```md
Use the subagent tool to consult the `advisor` agent about: $@

The advisor should:
1. identify the hard part
2. suggest the next investigation or decision
3. surface concrete risks
4. return a recommendation, not a full implementation
```

### README / skill updates
- Add `advisor` to the bundled agent list once shipped.
- Add one example such as:
  - “ask advisor whether this migration should be split before sending it to worker”
  - “have worker consult advisor on the failing test loop”
- In `spawn-subagents`, add guidance that advisor use is optional and should be reserved for tricky or high-risk cases.

# Files to create

- `packages/subagent/agents/advisor.md`
- `packages/subagent/prompts/consult-advisor.md`

# Files to modify

- `packages/subagent/agents/worker.md` — add narrow escalation guidance
- `packages/subagent/agents/planner.md` — add narrow escalation guidance
- `packages/subagent/agents/reviewer.md` — add narrow escalation guidance
- `packages/subagent/README.md` — document the new advisor role and one or two examples
- `packages/subagent/skills/spawn-subagents/SKILL.md` — explain when to use advisor vs. planner/reviewer

# Testing notes

- If this remains markdown-only, there is no TypeScript validation requirement.
- Manually test one focused consult, such as a planner or worker asking advisor a hard question, and verify:
  - the advisor returns a recommendation rather than trying to own the full task
  - the caller stays in charge of implementation or review
  - the exchange is shorter and more targeted than a full additional workflow
- If you introduce any helper TS module later to render consult packets, run `bun run --filter '@dreki-gg/pi-subagent' typecheck`.

# Patterns to follow

- `packages/subagent/skills/write-an-agent/SKILL.md:15-20` and `:46-67` — keep the new agent narrow, concise, and output-contract-driven
- `packages/subagent/agents/planner.md:9-38` — example of a specialist planner role that the advisor should complement, not replace
- `packages/subagent/agents/reviewer.md:10-37` — example of a verifier role that may occasionally need escalation
- `packages/subagent/agents/worker.md:9-26` — example of a primary owner role that should remain in charge after consulting advisor
- `packages/subagent/skills/spawn-subagents/SKILL.md:23-58` — existing specialist-selection guidance to extend with optional escalation
