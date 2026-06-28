# 1. Precondition gate for destructive plan tasks

Date: 2026-06-27

## Status

Accepted.

## Context

Plans produced by plan-mode suffer a class of failure we call **precondition drift**: a task asserts a premise like "X is unused, delete it", the premise is wrong or stale (X still has live consumers the planner missed with a too-narrow grep), and the bad premise propagates. Downstream tasks depend on it, and at execution time the worker tends to *improvise* — renaming or stubbing instead of deleting — rather than stopping. A real incident: a removal plan defined its scope by *directory* (delete these dirs) instead of by *feature* (trace every consumer upward through ops/commands/settings), shipped a partial removal, asserted "zero consumers" for a schema that three kept players still imported, and left an orphaned feature layer.

The existing guidance had the right *shape* — a post-condition **verification gate** in the planner prompt, and a soft "block if something seems wrong" rule for the executor — but no symmetric *pre*-condition mechanism, and the relevant elaboration lived in an opt-in skill (`planning-context`) that agents inconsistently read. Always-loaded prompt text was also skimmed. The result: the gate existed on paper but was not reliably applied.

## Decision

We add a **precondition gate**: the pre-condition mirror of the verification gate. Any task that deletes, removes, renames, or narrows a codebase symbol/export/file/feature must carry a re-runnable proof of its premise — a `Proof: <command>` line (grep/ast-grep over *every* exported symbol being removed, scoped by feature not directory) or an explicit auditable opt-out `Precondition: none — <reason>`.

This is enforced at three layers so it does not depend on agent discretion:

1. **Hoisted prompt rule** — the gate is a prominent top-level block in the planner prompt, flagged as enforced, not a buried paragraph.
2. **Deterministic reject in `submit_plan`** — a pure string scan (`precondition-guard.ts`, no LLM) detects destructive verb + codebase-scoped target with no proof signal, and **refuses to persist** the plan, returning the offending task ids and the escape-hatch instructions. The agent fixes the tasks and re-calls.
3. **Executor STOP rule** — the executor re-runs the proof first; if reality contradicts the premise (live consumers, a delete that breaks an import) it blocks instead of improvising.

## Considered Options

- **Side-effecting reviewer inside `submit_plan`** (run an LLM review pass on submit). Rejected: it gives `submit_plan` a hidden, non-deterministic side effect and couples finalization to a model call. We want `submit_plan` to stay a recorder.
- **Non-blocking warning string.** Rejected as the primary mechanism: a warning the agent *can* ignore *will* be ignored — that is precisely the observed failure mode (agents improvise past soft obstacles). We chose a deterministic **reject with a cheap escape hatch** instead, which is plain input validation, not a reviewer.
- **Structured `precondition` field on the task record.** Strictly better (machine-readable, harder to game) but `TaskRecord` lives in the external `@dreki-gg/taskman` package, so it is a cross-package schema migration. Deferred; we ship a prose `Proof:`/`Precondition:` convention now and may upgrade later.
- **Skill-only guidance.** Rejected: skills are opt-in and were demonstrably skipped; a must-do invariant cannot live only in a skill.

## Consequences

The trigger is deliberately narrow — destructive verb **and** a codebase-scoped target (path, code extension, backticked identifier, or code-construct noun), with generic words like "file" excluded — because false-positive fatigue is the failure mode that gets guards ignored. This means some destructive changes phrased unusually ("sunset", "collapse into") will slip through; the verb set is expected to grow as misses are observed. Because the convention is prose, an agent could in principle paste a token grep that proves nothing — the executor STOP rule is the backstop. Legitimate "this genuinely has no consumers" cases are not blocked: the `Precondition: none — <reason>` opt-out keeps flow moving while leaving an auditable record. `submit_plan` now has one new way to *not* persist (rejection), but it remains deterministic and LLM-free.
