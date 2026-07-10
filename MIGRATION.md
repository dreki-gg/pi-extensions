# Pi extensions → skills migration ledger

Disposition of every package under `packages/`. Skills live in `github.com/jalbarrang/skills`. Nothing in this repo is deleted during migration — pi extensions keep working for pi sessions while portable skills land.

| Package | Disposition | Reason |
|---------|-------------|--------|
| `ast-grep` | ported to skill `ast-grep` | Direct CLI usage; skill polished to match extension dry-run/`--update-all` safety |
| `browser-tools` | ported to skill `browser` | Harness-agnostic browser tooling under the `browser` skill name |
| `code-reviewer` | ported to skill `code-reviewer` | Upgraded portable review skill |
| `command-sandbox` | stays pi-only | Shared shell-safety library consumed by pi extensions, not an agent-facing skill |
| `context-folders` | stays pi-only | Injects sibling-folder context into the pi system prompt |
| `context7` | ported to skill `context7` | Library-docs lookup via Context7 MCP/API |
| `datadog` | ported to skill `datadog` | Datadog query/ops as a portable skill |
| `discord` | ported to skill `discord` | Discord messaging as a portable skill |
| `firestore` | ported to skill `firestore` | Skill drives `@dreki-gg/firestore-cli` instead of the pi tool surface |
| `firestore-cli` | stays as published npm CLI | Standalone CLI consumed by skill `firestore`; not a pi session extension |
| `handoff` | retired-superseded | Portable `handoff` skill already exists in the skills repo |
| `jira` | ported to skill `jira` | Jira via `acli` as a portable skill |
| `lsp` | not ported — dropped | Harness-native LSP (Cursor, editors) covers it; a portable one-shot skill was built, verified, and removed as not worth keeping |
| `past-chats` | stays pi-only | Tied to pi session JSONL format and `@chat:` / `@session:` editor tokens |
| `plan-mode` | retired-superseded | Superseded by `taskman` CLI + `planwork` skill |
| `questionnaire` | stays pi-only | Interactive TUI for structured answers inside pi |
| `slack` | ported to skill `slack` | Slack messaging as a portable skill |
| `subagent` | ported to skill `subagents` | Skill ports the workflow; pi extension also stays for pi sessions |
| `taskman` | stays as published npm CLI | Standalone plan ledger CLI consumed by `planwork`; extracted from `plan-mode` |
| `workflow` | `/commit` → skill `commit`; rest stays pi-only | Commit flow ports to skill `commit` (landing in this batch); remaining workflow helpers stay pi-only |

Nothing is deleted from `pi-extensions`. Pi keeps installing and running these packages during the migration; skills are additive ports (or supersessions) so other harnesses can use the same capabilities without loading a pi extension.
