---
"@dreki-gg/pi-context7": patch
"@dreki-gg/pi-lsp": patch
"@dreki-gg/pi-questionnaire": patch
"@dreki-gg/pi-subagent": patch
"@dreki-gg/pi-modes": patch
"@dreki-gg/pi-plan-mode": patch
---

Migrate TypeBox usage and session replacement flows for Pi 0.69 compatibility.

- switch extension imports from `@sinclair/typebox` to `typebox`
- update package peer dependencies to require `typebox`
- move subagent `/run-agent` fork-at follow-up work into `withSession` so post-fork operations use the replacement session safely
- add command argument completions for `/run-agent`, `/delegate-agents`, `/preset`, `/mode`, and `/plan`
- align local development dependencies with Pi 0.69 for typechecking and compatibility checks
