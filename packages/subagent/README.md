# @dreki-gg/pi-subagent

Subagent tool and delegate orchestration for pi — isolated agents, parallel scouts, planning gates, and workflow presets.

## Install

```bash
pi install npm:@dreki-gg/pi-subagent
```

## Subagent Tool

The `subagent` tool supports three modes:

| Mode | Description |
|------|-------------|
| Single | `{ agent, task }` — one agent, one task |
| Parallel | `{ tasks: [...] }` — multiple agents concurrently |
| Chain | `{ chain: [...] }` — sequential with `{previous}` placeholder |

## Delegate Command

After a design/grill session:

```
/delegate
```

Or with an explicit task:

```
/delegate implement the auth flow we designed
```

### How it works

1. **Synthesize** — extracts goal, decisions, constraints, architecture, intent from conversation
2. **Confirm** — shows synthesis for approval
3. **Pick workflow** — suggests one, you confirm or override
4. **Execute** — runs phases sequentially with parallel scouts
5. **Plan gate** — shows planner output for approval before worker runs
6. **Summary** — full phase-by-phase report with usage totals

### Workflows

| Workflow | Phases |
|----------|--------|
| Scout only | scout ∥ docs-scout |
| Scout and plan | scout ∥ docs-scout → planner |
| Implement | scout ∥ docs-scout → planner → worker |
| Implement and review | scout ∥ docs-scout → planner → worker → reviewer |
| Quick fix | worker |
| Review | reviewer |

## Agent Definitions

Create agent files in `~/.pi/agent/agents/` as markdown with YAML frontmatter:

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: anthropic/claude-haiku-4-5
---

System prompt for the agent.
```

### Bundled Agents

The package ships with these agents out of the box:

- `scout` — fast codebase recon
- `docs-scout` — Context7-first documentation lookup
- `planner` — implementation planning
- `worker` — general-purpose implementation
- `reviewer` — code review
- `ux-designer` — frontend UI design

User agents in `~/.pi/agent/agents/` override bundled agents by name.

### Managing Agents

```
/delegate-agents              # list all agents with source
/delegate-agents reset scout  # restore bundled version
/delegate-agents reset --all  # restore all bundled versions
/delegate-agents edit scout   # copy bundled to user dir for customization
```

## Bundled Resources

### Skill
- `subagent-workflows` — guides the model on when/how to use subagent orchestration

### Prompt Templates
- `/implement` — scout → planner → worker
- `/scout-and-plan` — scout → planner
- `/implement-and-review` — worker → reviewer → worker
