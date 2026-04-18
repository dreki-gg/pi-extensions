# ~/.pi Audit

Date: 2026-04-18

## Summary
Your pi home is functional but carrying avoidable duplication and cache/session weight.

## What is installed
- Packages enabled in `~/.pi/agent/settings.json`:
  - `@dreki-gg/pi-context7`
  - `@dreki-gg/pi-subagent`
  - `@dreki-gg/pi-questionnaire`
  - `@dreki-gg/pi-modes`
- Default provider/model: `openai / gpt-5.4`
- Thinking: `medium`
- Transport: `websocket`

## Global agents
Files in `~/.pi/agent/agents/`:
- `docs-scout`
- `planner`
- `reviewer`
- `scout`
- `ux-designer`
- `worker`
- `editorial-reviewer`

### Important finding
These six global agents are byte-for-byte identical to the bundled agents in `packages/subagent/agents/`:
- `docs-scout`, `planner`, `reviewer`, `scout`, `ux-designer`, `worker`

Nuance:
- pi packages cannot currently declare `agents` in package metadata
- if your installed subagent package mirrors bundled agents into `~/.pi/agent/agents/`, this duplication is expected infrastructure, not accidental drift
- in that case, these files should be treated as **package-managed mirrors**, not personal overrides

Real risk:
- there is no first-class distinction between managed mirrored agents and user-authored agents
- without that distinction, audits can misclassify them and updates/customization rules stay ambiguous

Recommendation:
- keep `editorial-reviewer`
- treat the six identical files as managed package artifacts unless you intentionally customized them
- add a managed-agent marker/manifest in the subagent package so mirrored files can be audited safely

## Disk usage
- `~/.pi`: **617M**
- `~/.pi/agent`: **474M**
- `~/.pi/agent/sessions`: **261M**
- `~/.pi/agent/npm`: **182M**
- `~/.pi/bin`: **85M**
- `~/.pi/agent/extensions`: **30M**

Largest session buckets:
- `work/rundot/run-platform`: **62M**
- `work/common/asset-bot`: **61M**
- `fun/umalator/global`: **45M**

## Cleanup candidates
1. Old session trees in `~/.pi/agent/sessions/`
2. Temporary runtime session directories under `~/.pi/agent/sessions/--var-folders-*`
3. `~/.pi/agent/npm` if package cache can be rebuilt
4. Disabled or stale extension folders if no longer used

## Configuration notes
- `~/.pi/agent/skills/` exists but is effectively unused/empty
- You already rely heavily on packages instead of hand-managed local skills
- Repo-specific behavior is better moved to project-local `.pi/agents/` than global user agents

## Recommendation set
- Short term: reset/delete identical global agent overrides
- Medium term: prune runtime session temp directories and old sessions
- Ongoing: keep global agents personal, keep repo behavior project-local
