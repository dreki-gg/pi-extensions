---
"@dreki-gg/pi-subagent": patch
---

feat(subagent): show live tool-aware status in working message during /run-agent

Previously `/run-agent` only showed a transient notification, leaving users with no visibility into what the background agent was doing (especially after a fork-at session switch that visually looks like a reload). Now the working message updates in real-time as the agent works:

- `scout · starting...`
- `scout · reading …/src/utils.ts`
- `scout · $ bun test --filter...`
- `scout · editing …/config.json`
- `scout · thinking...`

Added `onToolExecutionStart` callback to `spawnPiAgent` and `runAgent` to surface `tool_execution_start` events from the JSON stream.
