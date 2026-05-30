---
name: planning-context
description: Maintain a living context.md during planning to capture intent, decisions, constraints, open questions, and discarded options before finalizing a plan. Use whenever you are in plan mode and converging on an approach, especially before calling submit_plan.
---

# Planning Context

`context.md` is the living written record of a planning conversation. It exists to slow the jump from "read the codebase" to "submit the plan" — the moment where reasoning usually gets lost. Write it as you think, not as an afterthought.

## When to use

Use this throughout any planning session, from the first real decision onward. If you have read code and formed an opinion but have not written anything down, that is the signal to update `context.md`.

## What it is

`.plans/<plan-name>/context.md` — a deliberation document, not a plan. It captures the *why* and the *roads not taken*, which `HANDOFF.md` and the task list deliberately omit.

## Process

### 1. Create it early

As soon as you understand the intent, write `.plans/<plan-name>/context.md` with the `write` tool. Do not wait until you are ready to submit.

### 2. Keep these sections current

- **Intent** — what the user actually wants, in their terms
- **Decisions** — choices made and the reasoning behind each
- **Constraints** — technical, product, or process limits that shape the work
- **Open questions** — anything unresolved; do not submit a plan with silent unknowns
- **Discarded options** — approaches considered and rejected, with why. This is the highest-value section and the one most often skipped.

### 3. Style

Caveman-lite: professional, tight, no filler. Bullet points over prose. Update in place as understanding shifts — do not append a changelog.

### 4. Use it before submitting

`context.md` is the input to `submit_plan`, not a duplicate of it. Before finalizing, re-read it: every open question resolved, every decision justified. The handoff is the distilled conclusion; `context.md` is the reasoning that earned it.

## Relationship to prototypes

For visual/UI work, a prototype is the visual sibling of `context.md` — see the `visual-prototype` skill. Both are deliberation artifacts. Written reasoning lives here; visual reasoning lives in the prototype.
