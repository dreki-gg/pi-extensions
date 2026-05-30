---
'@dreki-gg/pi-plan-mode': minor
---

Reframe plan-mode HTML as a planning-phase visual aid instead of a finalization receipt.

- `submit_plan` no longer generates `plan.html`. It writes only `tasks.jsonl`, `HANDOFF.md`, and the manifest entry. The previous HTML duplicated the handoff and task list (already tracked elsewhere) and was never opened.
- Added a `preview_prototype` tool, available during planning. It renders self-contained Pug to a standalone HTML visual aid under `.plans/_prototypes/`, opens it, and notifies the path — so the user can react to a UI/component/style design *before* the plan hardens.
- Added a bundled `visual-prototype` skill that routes UI/component/layout/style planning work to `preview_prototype` before `submit_plan`.
- Added a bundled `planning-context` skill that drives the living `context.md` deliberation discipline (intent, decisions, constraints, open questions, discarded options).
