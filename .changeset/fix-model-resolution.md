---
"@dreki-gg/pi-delegate": patch
"@dreki-gg/pi-subagent": patch
---

Use provider-qualified model IDs in agent frontmatter to work around upstream pi model resolution bug where bare IDs (e.g. `gpt-5.4`) can resolve to the wrong provider (e.g. `azure-openai-responses` instead of `openai`).
