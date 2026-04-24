# @dreki-gg/pi-subagent

Subagent tool and direct agent runs for pi — isolated agents, parallel scouts, manager workflows, and bundled agents.

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

Optional overrides:
- `model` — override the agent's default model for one run, or set a default for all tasks/steps in a call
- `thinking` — override the agent's default reasoning level for one run, or set a default for all tasks/steps in a call

Notes:
- `/run-agent` provides autocomplete for `--model` and `--thinking`
- the `subagent` tool supports the same fields in its schema, but this package does not currently add custom interactive autocomplete for tool-call JSON parameters

## Opinionated Defaults

This package is intentionally opinionated about orchestration:

- Use **parallel mode for discovery, not competing edits**.
- Prefer **one worker** and surround it with scouts, planners, and reviewers.
- Use **chain mode** when work needs ordered handoffs.
- Treat `reviewer` as a **verifier with fresh context**, not as a second writer.
- Use `advisor` for **targeted second opinions** on tricky or high-risk cases, not as a default extra hop.
- Only split implementation across multiple workers when file ownership is clearly partitioned.

A good default mental model is: **parallel readers, single writer**.

See [`docs/orchestration-principles.md`](./docs/orchestration-principles.md) for the fuller guidance.

## Recommended Usage

In day-to-day use, the main agent should usually call the `subagent` tool from normal conversation.

Safe defaults:
- "spawn a scout for the auth code"
- "run scout and docs-scout in parallel"
- "have planner make a plan, then worker implement it"
- "send this to reviewer"
- "ask advisor whether this migration should be split before sending it to worker"
- "use manager for this cross-package migration"

For direct user-invoked single-agent runs, use:

```text
/run-agent worker implement the auth flow we discussed
/run-agent --model anthropic/claude-opus-4-6 --thinking high reviewer review the latest diff
```

Autocomplete notes:
- `/run-agent --model` suggests available configured models plus models referenced by discovered agents
- `/run-agent --thinking` suggests supported reasoning levels such as `off`, `minimal`, `low`, `medium`, `high`, and `xhigh`

For reusable multi-step workflows, prefer the main agent calling the `subagent` tool directly in `single` / `parallel` / `chain` mode rather than relying on canned slash workflows.

Examples:

```text
spawn scout and docs-scout in parallel for auth session refresh
have worker implement the questionnaire validation fix
send this diff to reviewer, and if a claim needs proof use validator or bug-prover
ask advisor whether this migration should be split before implementation
use manager for this cross-package migration
```

Recommended pattern in practice:
- `parallel`: `scout` + `docs-scout` for repo and docs recon
- `chain`: `scout` → `planner` → `worker` for coherent implementation
- `chain`: `worker` → `reviewer`, then optionally `validator` / `bug-prover`, then `worker` for a prove-before-fix loop
- `single`: `advisor` for a focused second opinion on a hard decision, failing test loop, or high-risk change
- `single`: `manager` for multi-slice work that needs bounded delegation and synthesis

`advisor` and `manager` are higher-level entry points built on the same `single` / `parallel` / `chain` primitives. `advisor` is for capability routing and second opinions; `manager` is for coherent delegation, not arbitrary peer-to-peer swarms. `validator` and `bug-prover` support evidence-driven review: validate a claim first, then build the smallest repro only when needed.

## Direct Agent Runs

Run one agent directly from the current session:

```text
/run-agent [--scope user|project|both] [--model <id>] [--thinking <level>] [--yes-project-agents] <agent> [task]
```

Examples:

```text
/run-agent scout trace how auth state is loaded
/run-agent validator validate whether this suspected regression is real
/run-agent bug-prover create a minimal failing repro for the auth refresh bug
/run-agent advisor sanity-check whether this migration should be split
/run-agent manager coordinate a multi-package migration plan
/run-agent worker implement the refactor we just planned
/run-agent --scope project reviewer review the latest changes
```

If the chosen agent frontmatter sets `sessionStrategy: fork-at`, the command clones the current active path into a new session before running the agent. That keeps long implementation runs isolated in their own branch while preserving the original conversation.

### `run-agent` Flags

| Flag | Meaning |
|------|---------|
| `--scope user|project|both` | Which agent layers to use. Default: `user` |
| `--model <id>` | Override the agent model for this run |
| `--thinking <level>` | Override the default reasoning level for this run |
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

| Agent | Purpose | Default model | Default reasoning level |
|------|---------|---------------|-------------------------|
| `scout` | Fast codebase recon | `openai/gpt-5.4-mini` | `medium` |
| `docs-scout` | Context7-first documentation lookup | `openai/gpt-5.4-mini` | `medium` |
| `planner` | Implementation planning | `openai/gpt-5.4` | `high` |
| `worker` | General-purpose implementation | `openai/gpt-5.4` | `medium` |
| `reviewer` | Code review | `openai/gpt-5.4` | `medium` |
| `validator` | Validate or falsify a specific bug or behavior claim from code, tests, and commands | `openai/gpt-5.4` | `medium` |
| `bug-prover` | Create the smallest failing repro for a suspected bug | `openai/gpt-5.4` | `medium` |
| `advisor` | Focused second-opinion consult for tricky planning, implementation, or review decisions | `openai/gpt-5.4` | `medium` |
| `manager` | Bounded orchestration for multi-slice work | `openai/gpt-5.4` | `high` |
| `ux-designer` | Frontend UI design | `anthropic/claude-opus-4-6` | `medium` |

Notes:
- `worker`, `reviewer`, `bug-prover`, and `manager` default to `sessionStrategy: fork-at`.
- "Default reasoning level" maps to the frontmatter field `thinking` and can be overridden per run.

Resolution order is: bundled → user (`~/.pi/agent/agents/`) → project (`.pi/agents/`). Project agents override user and bundled agents by name.

Optional frontmatter:
- `thinking` — default reasoning effort for the spawned pi process
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

### No Prompt Templates by Design
This package intentionally does **not** ship canned workflow prompts.

Prefer:
- normal conversation that leads the main agent to call `subagent`
- direct `/run-agent <agent> ...` for explicit single-agent runs
- examples in this README and `docs/orchestration-principles.md` for common orchestration shapes
