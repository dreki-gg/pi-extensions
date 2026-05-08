---
"@dreki-gg/pi-subagent": minor
---

Refactor agent distribution from custom `pi.agents` to standard `pi.prompts`

- Rename `agents/` directory to `prompts/` to follow pi's standard resource type
- Use `pi.prompts` in package.json instead of non-standard `pi.agents`
- Remove legacy bundled-directory fallback — agent prompts are now resolved via pi's package manager
- Remove `/delegate-agents` command (unused; `/run-agent` and `subagent` tool cover all usage)
- Extract shared spawn logic into `spawn-utils.ts`, eliminating cross-file duplication between `agent-runner.ts` and `index.ts`
- Remove dead exports (`formatAgentList`, `buildSynthesisPrompt`, `SYNTHESIS_INSTRUCTION`)
- Clean up unused imports
- Maintainability score improved from 70.7 (moderate) to 90.6 (good)
- Model configuration (`model`, `thinking`, `tools` frontmatter) is unchanged
