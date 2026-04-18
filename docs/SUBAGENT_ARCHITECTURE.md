# Subagent Architecture

## Goals
- Keep the published package generic
- Keep repo development workflows project-local
- Make project-local agents usable from direct `subagent` calls
- Keep `/delegate` optional, not central
- Keep every agent definition short and replaceable

## Constraint
- pi packages/extensions do not currently have a first-class `agents` manifest like they do for extensions, skills, prompts, and themes
- because of that, agent distribution may require a runtime mirror/sync layer into `~/.pi/agent/agents/`
- that mirror should be treated as managed package state, not automatically as a user override

## Layers

### 1. Bundled package source layer
Path: `packages/subagent/agents/`

Purpose:
- reusable default agents shipped with `@dreki-gg/pi-subagent`
- source-of-truth definitions inside the package repo
- safe defaults for users outside this repo

Current bundled roles:
- `scout`
- `docs-scout`
- `planner`
- `worker`
- `reviewer`
- `ux-designer`

### 2. Managed mirror layer
Path: typically `~/.pi/agent/agents/`

Purpose:
- operational workaround for pi's lack of package-declared agents
- makes package agents available in environments that rely on agent files in the user dir
- should ideally be tagged as package-managed, not confused with user-authored overrides

Recommended future shape:
- sync manifest with package name, version, source hash, target path
- `managed: true` marker in mirrored files or sidecar metadata
- explicit commands: sync, doctor, eject, prune

### 3. Project-local repo layer
Path: `.pi/agents/`

Purpose:
- override the generic roles when working inside `pi-extensions`
- encode repo-specific boundaries, docs, validation, and packaging rules

Current repo roles:
- `scout` — workspace/package reconnaissance
- `docs-scout` — local pi docs first, then external docs
- `planner` — package-scoped plans with validation + release impact
- `worker` — implementation with package validation
- `reviewer` — diff/release/docs review

### 4. Authoring layer
Path: `.pi/skills/write-an-agent.md`

Purpose:
- standardize how new agents are written
- keep each agent under 100 lines
- push complex behavior into skills instead of bloated prompts

## How to use it

### Primary UX: conversational spawning
- Tell the main agent to spawn the specialist you want.
- Examples:
  - "spawn a scout for the subagent package"
  - "run scout and docs-scout in parallel"
  - "have planner make a plan, then worker implement it"
  - "send this to reviewer"
- Under the hood, the main agent should use the `subagent` tool directly.

### Generic package behavior
- bundled definitions live in `packages/subagent/agents/`
- if your install strategy mirrors agents into `~/.pi/agent/agents/`, treat those as managed copies
- `subagent` tool with default `agentScope: "user"`

### Repo-local behavior
- project-local overrides live in `.pi/agents/`
- prefer `agentScope: "project"` or `"both"` for this repo
- use project scope when the task depends on repo-specific validation, packaging, or docs rules

### Optional explicit workflow mode
- `/delegate` remains useful for rigid gated flows
- use it when you want plan approval, workflow pinning, or manual phase control
- examples:
  - `/delegate --scope project --workflow implement <task>`
  - `/delegate --scope project --workflow scout-and-plan <task>`

## Design rules
- Project agents should override bundled names only when the repo needs different behavior
- One agent = one role + one output contract
- Read-only scouts/reviewers by default
- Keep prompts short; move bulky guidance into skills
- Prefer package-scoped validation commands

## Next cleanup outside this repo
- Distinguish managed mirrored agents from truly personal global agents
- Add sync metadata so audits and reset flows know which files are package-owned
- Keep only truly personal global agents unmarked in `~/.pi/agent/agents/`
