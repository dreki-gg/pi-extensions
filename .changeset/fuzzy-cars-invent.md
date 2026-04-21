---
"@dreki-gg/pi-context7": patch
"@dreki-gg/pi-modes": patch
"@dreki-gg/pi-subagent": minor
---

Sync the extensions repo with Pi 0.68.0 and improve direct agent runs.

- `@dreki-gg/pi-context7`: remove stale alias docs and align compatibility tests with the canonical tool names actually exported.
- `@dreki-gg/pi-modes`: use `before_agent_start.systemPromptOptions.selectedTools` when available so mode prompt text reflects the active prompt tool set.
- `@dreki-gg/pi-subagent`: add `/run-agent`, support `sessionStrategy: fork-at` in agent frontmatter, default bundled `worker` and `reviewer` to forked direct runs, and add a custom renderer for run summaries.
