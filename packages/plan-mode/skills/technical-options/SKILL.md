---
name: technical-options
description: Generate and rank competing options for a technical decision using parallel evaluators. Use when the user wants a structured comparison of implementation approaches, architecture alternatives, or engineering tradeoffs before choosing one. Not for binary yes/no or pure preference decisions.
disable-model-invocation: true
---

# Technical Options

Generate competing proposals for a technical decision, challenge the framing, then fan out to parallel voting agents for ranking.

## Process

### 1. Understand the problem

- Read relevant code and context
- Identify the core constraint or failure mode driving the decision
- Note available APIs, tools, and integration points

### 2. Research (optional)

Use `web_search` + `web_visit` if external patterns would help. Skip for purely internal decisions. If those tools are unavailable, proceed from repo context only.

### 3. Generate 3–5 proposals

Each proposal needs:
- **Letter** (A–E) and a short memorable name
- **One-paragraph description** with the key mechanism
- **Pros and cons** — honest tradeoffs, not sales pitches

Rules:
- Span the solution space — don't cluster around one idea
- Include a simplest-possible option and a most-robust option
- Include an unconventional or contrarian option when possible
- 3 proposals for small choices, 4–5 for architectural decisions

### 4. Challenge the framing

Before voting, spawn one `advisor` agent (or equivalent) with this task:

> "Here are N proposals for [problem]. What important constraint, framing assumption, or missing approach is absent? If you find a materially distinct option the proposals don't cover, describe it. If the slate is well-shaped, say so."

Only amend the proposal slate if the challenger surfaces a genuinely distinct option. Do not add variations of existing proposals.

### 5. Fan out to 3 voting agents

Use `subagent` in parallel mode with 3 tasks. Each voter gets identical proposals but a different evaluation preamble. The lenses are the contract; agent names are flexible — use `advisor`, `reviewer`, or whatever is available:

**Lens 1 — Pragmatic engineer:**
> "You value shipping speed and simplicity. You penalize over-engineering. A complex solution must justify its complexity with concrete failure modes the simple one can't handle."

**Lens 2 — Reliability engineer:**
> "You value robustness, crash recovery, and correctness over speed. You penalize approaches that work in happy paths but have edge-case blind spots. If two are equally correct, prefer the one that fails louder."

**Lens 3 — Maintainability reviewer:**
> "You value clean abstractions, testability, and long-term ownership cost. You penalize approaches that fight the framework or create implicit coupling. The best solution is one a new team member understands in 5 minutes."

Each voter must output a strict ranking:
```
1st: [Letter] — [reason]
2nd: [Letter] — [reason]
...
```

Scale to 5 voters only for high-stakes decisions (new system boundaries, irreversible migrations, public API design).

### 6. Tally and present

**Scoring**: Borda count — 1st = N points, 2nd = N-1, ..., last = 1.

**Tiebreaker**: Most 1st-place votes. If still tied, present the split to the user honestly and let them decide — do NOT force a winner.

Present in this order:
1. **Problem framing** (one sentence)
2. **Proposals** (A–E with names)
3. **Vote table** with per-voter rankings and scores
4. **Winner** with consensus reasoning
5. **Dissent** — where voters disagreed and why
6. **Recommendation** — winner, plus any elements worth borrowing from runner-up
7. **Question to user** — proceed, combine, or reconsider?

### 7. Confirm with user

Do NOT auto-implement. Ask whether to proceed with the winner, combine elements, or reconsider.

## When NOT to use this

- Binary yes/no decisions — just discuss pros/cons
- Decisions with an obviously correct answer — just do it
- Pure preference decisions with no technical tradeoffs — ask the user
- Reversible decisions where trying the simplest option first is cheap
