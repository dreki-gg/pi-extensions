---
'@dreki-gg/pi-subagent': minor
---

Improve bundled agent resolution and `/delegate` workflow control in `@dreki-gg/pi-subagent`.

- Add explicit agent source tracking for bundled, user, and project agents.
- Resolve agents with layered precedence: bundled → user → project.
- Add `agentScope` support to delegated execution so workflows can opt into user, project, or both agent layers.
- Add `/delegate` argument parsing for `--scope`, `--workflow`, and `--yes-project-agents`.
- Add a confirmation step before running project-local agents from `/delegate` or the `subagent` tool when UI is available.
- Replace the old `subagent-workflows` skill with `spawn-subagents`, which steers the assistant toward conversational `subagent` usage and keeps `/delegate` as an explicit gated workflow option.
