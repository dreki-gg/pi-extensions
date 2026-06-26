---
"@dreki-gg/pi-subagent": minor
---

Add a Cursor ACP backend: set a subagent's model to `cursor:<model>` (e.g. `cursor:composer-2.5`) to run the task on Cursor's agent via the Agent Client Protocol instead of spawning a `pi` process. Routing happens in one shared dispatcher, so it works across single / parallel / chain modes and the `/run-agent` command with an unchanged result shape. Permission requests are auto-approved; the `tools` allowlist and `thinking` level do not apply to `cursor:` models. Requires `cursor-agent` installed and authenticated (`agent login`).
