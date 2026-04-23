---
"@dreki-gg/pi-subagent": minor
---

Remove the `/delegate` command from `@dreki-gg/pi-subagent`.

- keep the `subagent` tool as the primary orchestration surface
- keep `/run-agent` for direct named-agent runs
- keep `/delegate-agents` for agent management
- update docs and the `spawn-subagents` skill to point rigid multi-step flows toward prompt templates and direct `subagent` chain/parallel usage instead of `/delegate`
