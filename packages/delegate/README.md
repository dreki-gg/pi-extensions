# @dreki-gg/pi-delegate

Orchestration command for pi — `/delegate` with workflow presets, parallel scouts, planning gates, and subagent execution.

## Install

```bash
pi install npm:@dreki-gg/pi-delegate
```

**Note:** This package bundles agent definitions, but pi discovers agents from `~/.pi/agent/agents/`. On first load, the extension bootstraps agent files into that directory if they're missing.

## Usage

After a design/grill session:

```
/delegate
```

Or with an explicit task:

```
/delegate implement the auth flow we designed
```

## How it works

1. **Synthesize** — extracts goal, decisions, constraints, architecture, intent from conversation
2. **Confirm** — shows synthesis for approval
3. **Pick workflow** — suggests one, you confirm or override
4. **Execute** — runs phases sequentially with parallel scouts
5. **Plan gate** — shows planner output for approval before worker runs
6. **Summary** — full phase-by-phase report with usage totals

## Workflows

| Workflow | Phases |
|----------|--------|
| Scout only | scout ∥ docs-scout |
| Scout and plan | scout ∥ docs-scout → planner |
| Implement | scout ∥ docs-scout → planner → worker |
| Implement and review | scout ∥ docs-scout → planner → worker → reviewer |
| Quick fix | worker |
| Review | reviewer |

## Bundled Resources

### Agents (bootstrapped to `~/.pi/agent/agents/`)
- `scout` — fast codebase recon
- `docs-scout` — Context7-first documentation lookup
- `planner` — implementation planning
- `worker` — general-purpose implementation
- `reviewer` — code review

### Skill
- `subagent-workflows` — guides the model on when/how to use subagent orchestration

### Prompt Templates
- `/implement` — scout → planner → worker
- `/scout-and-plan` — scout → planner
- `/implement-and-review` — worker → reviewer → worker
