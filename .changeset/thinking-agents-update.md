---
"@dreki-gg/pi-delegate": minor
"@dreki-gg/pi-subagent": minor
---

Support `thinking` frontmatter field in agent definitions to set reasoning effort level.

- Read `thinking` from agent `.md` frontmatter and pass `--thinking <level>` to spawned pi processes
- Update all bundled agents to use OpenAI models with thinking levels
- Add `ux-designer` agent for frontend UI design with anti-Codex aesthetic guidelines
