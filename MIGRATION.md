# Pi extensions → skills migration ledger

Disposition of every package under `packages/`. Skills live in `github.com/jalbarrang/skills`. Extracted packages now live in their own repos and were removed from `packages/`; everything else is frozen here.

| Package | Disposition | Reason |
|---------|-------------|--------|
| `ast-grep` | removed — package and skill both dropped | Models default to grep/rg even with a native tool and prompt nudge; the CLI remains usable ad hoc, no dedicated tooling kept (npm @dreki-gg/pi-ast-grep@0.2.0 stays published but unmaintained) |
| `browser-tools` | ported to skill `browser`; extension extracted to [jalbarrang/pi-browser-tools](https://github.com/jalbarrang/pi-browser-tools) | Harness-agnostic browser tooling under the `browser` skill name |
| `code-reviewer` | ported to skill `code-reviewer`; extension extracted to [jalbarrang/pi-code-reviewer](https://github.com/jalbarrang/pi-code-reviewer) | Upgraded portable review skill |
| `command-sandbox` | extracted to [jalbarrang/pi-command-sandbox](https://github.com/jalbarrang/pi-command-sandbox) | Shared shell-safety library consumed by pi extensions, not an agent-facing skill |
| `context-folders` | stays pi-only | Injects sibling-folder context into the pi system prompt |
| `context7` | ported to skill `context7`; extension extracted to [jalbarrang/pi-doc-search](https://github.com/jalbarrang/pi-doc-search) as `@dreki-gg/pi-doc-search` (tools renamed `context7_*` → `doc_search_*`) | Library-docs lookup via Context7 MCP/API |
| `datadog` | ported to skill `datadog`; extension extracted to [jalbarrang/pi-datadog](https://github.com/jalbarrang/pi-datadog) | Datadog query/ops as a portable skill |
| `discord` | ported to skill `discord` | Discord messaging as a portable skill |
| `firestore` | removed — superseded by `firestore-cli` + skill | Same domain logic lived twice; the CLI + skill cover every harness including pi (npm @dreki-gg/pi-firestore@0.3.1 stays published, unmaintained) |
| `firestore-cli` | extracted to [jalbarrang/firestore-cli](https://github.com/jalbarrang/firestore-cli) | Standalone npm CLI consumed by skill `firestore`; no pi coupling, moved out with history |
| `handoff` | retired-superseded; extension extracted to [jalbarrang/pi-handoff](https://github.com/jalbarrang/pi-handoff) | Portable `handoff` skill already exists in the skills repo |
| `jira` | ported to skill `jira`; extension extracted to [jalbarrang/pi-jira](https://github.com/jalbarrang/pi-jira) | Jira via `acli` as a portable skill |
| `lsp` | not ported as a skill; extension extracted to [jalbarrang/pi-lsp](https://github.com/jalbarrang/pi-lsp) | Harness-native LSP (Cursor, editors) covers it for other harnesses; the pi extension stays maintained in its own repo |
| `past-chats` | stays pi-only | Tied to pi session JSONL format and `@chat:` / `@session:` editor tokens |
| `plan-mode` | retired — parity proven; extension extracted to [jalbarrang/pi-plan-mode](https://github.com/jalbarrang/pi-plan-mode) | planwork skill + taskman CLI (0.5.0: create-initiative, revise-plan) reproduce the full workflow on any harness; verified end-to-end by a zero-context cursor agent |
| `questionnaire` | extracted to [jalbarrang/pi-questionnaire](https://github.com/jalbarrang/pi-questionnaire) | Still used daily in pi; moved out with history. Outside pi, planwork's batched clarification rule (≤5 enumerated questions) replaces it |
| `slack` | ported to skill `slack`; extension extracted to [jalbarrang/pi-slack](https://github.com/jalbarrang/pi-slack) | Slack messaging as a portable skill |
| `subagent` | extracted to [jalbarrang/pi-subagent](https://github.com/jalbarrang/pi-subagent) | Heaviest-used extension; moved out with history and stays maintained for pi. The `subagents` skill covers other harnesses |
| `taskman` | extracted to [jalbarrang/taskman](https://github.com/jalbarrang/taskman) | Standalone plan ledger CLI consumed by `planwork` and `plan-mode` (now via npm ^0.4.0); moved out with history |
| `workflow` | `/commit` → skill `commit`; rest stays pi-only | Commit flow ports to skill `commit` (landing in this batch); remaining workflow helpers stay pi-only |

Packages marked "extracted" were moved to standalone repos and deleted from `packages/` when this repo was archived; their `@dreki-gg/*` npm packages remain installable and are maintained from the new repos. Everything else stays in place here, frozen: skills are additive ports (or supersessions) so other harnesses can use the same capabilities without loading a pi extension.
