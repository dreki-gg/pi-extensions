# @dreki-gg/pi-subagent

Subagent tool and direct agent runs for pi — isolated agents, parallel scouts, bundled agents, and workflow templates.

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

## Recommended Usage

In day-to-day use, the main agent should usually call the `subagent` tool from normal conversation.

Examples:
- "spawn a scout for the auth code"
- "run scout and docs-scout in parallel"
- "have planner make a plan, then worker implement it"
- "send this to reviewer"

For direct user-invoked single-agent runs, use:

```text
/run-agent worker implement the auth flow we discussed
```

For reusable multi-step workflows, prefer the bundled prompt templates or have the main agent call the `subagent` tool in `chain`/`parallel` mode directly.

Examples:

```text
/implement add auth session refresh support
/scout-and-plan migrate the subagent docs
/implement-and-review tighten questionnaire validation
```

## Direct Agent Runs

Run one agent directly from the current session:

```text
/run-agent [--scope user|project|both] [--yes-project-agents] <agent> [task]
```

Examples:

```text
/run-agent scout trace how auth state is loaded
/run-agent worker implement the refactor we just planned
/run-agent --scope project reviewer review the latest changes
```

If the chosen agent frontmatter sets `sessionStrategy: fork-at`, the command clones the current active path into a new session before running the agent. That keeps long implementation runs isolated in their own branch while preserving the original conversation.

### `run-agent` Flags

| Flag | Meaning |
|------|---------|
| `--scope user|project|both` | Which agent layers to use. Default: `user` |
| `--yes-project-agents` | Disable the confirmation prompt for project-local agents |

## Agent Definitions

Create agent files in `~/.pi/agent/agents/` or `.pi/agents/` as markdown with YAML frontmatter:

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: anthropic/claude-haiku-4-5
sessionStrategy: fork-at
---

System prompt for the agent.
```

### Bundled Agents

The package ships with these agents out of the box:

- `scout` — fast codebase recon
- `docs-scout` — Context7-first documentation lookup
- `planner` — implementation planning
- `worker` — general-purpose implementation (`sessionStrategy: fork-at` by default)
- `reviewer` — code review (`sessionStrategy: fork-at` by default)
- `ux-designer` — frontend UI design

Resolution order is: bundled → user (`~/.pi/agent/agents/`) → project (`.pi/agents/`). Project agents override user and bundled agents by name.

Optional frontmatter:
- `thinking` — reasoning effort for the spawned pi process
- `sessionStrategy: fork-at` — when used with `/run-agent`, clone the current active branch into a new session before running

> Note: pi now supports package-shipped agents via `pi.agents` (or conventional `agents/` directories). This package publishes its bundled agents that way, while user agents in `~/.pi/agent/agents/` and project agents in `.pi/agents/` still override them by name.

### Managing Agents

```
/delegate-agents              # list all agents with source
/delegate-agents reset scout  # restore bundled version
/delegate-agents reset --all  # restore all bundled versions
/delegate-agents edit scout   # copy bundled to user dir for customization
```

## Bundled Resources

### Skill
- `spawn-subagents` — guides the model on when/how to spawn specialized subagents conversationally

### Prompt Templates
- `/implement` — scout → planner → worker
- `/scout-and-plan` — scout → planner
- `/implement-and-review` — worker → reviewer → worker
