---
"@dreki-gg/pi-delegate": patch
---

Fix agent files not updating on `pi update`. Agents are now read directly from the bundled package directory instead of being copied to `~/.pi/agent/agents/` on first run. User overrides in `~/.pi/agent/agents/` still take precedence by name.

Added `/delegate-agents` command to manage agents:
- `/delegate-agents list` — show all agents with their source (bundled, user override, user-only)
- `/delegate-agents reset <name|--all>` — delete user override, restoring the bundled version
- `/delegate-agents edit <name>` — copy a bundled agent to the user directory for customization

Removed the `bootstrapAgents()` session_start hook that was preventing bundled agent updates from reaching users.
