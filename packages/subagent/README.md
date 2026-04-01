# @dreki-gg/pi-subagent

Subagent tool for pi — delegate tasks to specialized agents with isolated context windows.

## Install

```bash
pi install npm:@dreki-gg/pi-subagent
```

## Usage

The `subagent` tool supports three modes:

| Mode | Description |
|------|-------------|
| Single | `{ agent, task }` — one agent, one task |
| Parallel | `{ tasks: [...] }` — multiple agents concurrently |
| Chain | `{ chain: [...] }` — sequential with `{previous}` placeholder |

## Agent Definitions

Create agent files in `~/.pi/agent/agents/` as markdown with YAML frontmatter:

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-haiku-4-5
---

System prompt for the agent.
```

## Included via @dreki-gg/pi-delegate

This package provides the raw execution primitive. For structured orchestration workflows, use `@dreki-gg/pi-delegate`.
