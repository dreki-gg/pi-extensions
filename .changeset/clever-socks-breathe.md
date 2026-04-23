---
"@dreki-gg/pi-plan-mode": minor
---

Add `@dreki-gg/pi-plan-mode`, a Cursor-like planning workflow for pi.

- add a hard-enforced read-only planning phase with `/plan` and `--plan`
- prefer `questionnaire` for structured clarification when scope is unclear
- add `/plan-domain` and `/plan-plans` workflow handoffs, with skill-based execution when `domain-model` and `create-implementation-plans` are available
- add a controlled plan-file authoring phase plus `/plan-execute` for restoring full tool access and running the approved plan
- persist extracted plan steps and workflow phase across session resume and tree navigation
