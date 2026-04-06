---
"@dreki-gg/pi-subagent": minor
---

Merged `@dreki-gg/pi-delegate` into `@dreki-gg/pi-subagent`. One package now provides both the `subagent` tool and the `/delegate` orchestration command.

### What's new in `@dreki-gg/pi-subagent`

- `/delegate` command — synthesize conversation into a task, pick a workflow, execute with scouts/planner/worker/reviewer
- `/delegate-agents` command — list, customize, or reset bundled agents
- 6 bundled agents: scout, docs-scout, planner, worker, reviewer, ux-designer
- `subagent-workflows` skill for guided orchestration
- 3 prompt templates: implement, scout-and-plan, implement-and-review

### Bundled agent discovery

Agents are now read directly from the package's `agents/` directory. User overrides in `~/.pi/agent/agents/` still take precedence by name. No file copying on session start.

Priority order: bundled (lowest) → user → project (highest).

### `@dreki-gg/pi-delegate` is deprecated

All functionality has moved to `@dreki-gg/pi-subagent`. Remove `pi-delegate` and use `pi-subagent` instead:

```bash
pi remove npm:@dreki-gg/pi-delegate
pi install npm:@dreki-gg/pi-subagent
```
