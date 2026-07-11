# Pi extensions → skills migration ledger

Disposition of every package under `packages/`. Skills live in `github.com/jalbarrang/skills`. Nothing in this repo is deleted during migration — pi extensions keep working for pi sessions while portable skills land.

| Package | Disposition | Reason |
|---------|-------------|--------|
| `ast-grep` | removed — package and skill both dropped | Models default to grep/rg even with a native tool and prompt nudge; the CLI remains usable ad hoc, no dedicated tooling kept (npm @dreki-gg/pi-ast-grep@0.2.0 stays published but unmaintained) |
| `browser-tools` | ported to skill `browser` | Harness-agnostic browser tooling under the `browser` skill name |
| `code-reviewer` | ported to skill `code-reviewer` | Upgraded portable review skill |
| `command-sandbox` | stays pi-only | Shared shell-safety library consumed by pi extensions, not an agent-facing skill |
| `context-folders` | stays pi-only | Injects sibling-folder context into the pi system prompt |
| `context7` | ported to skill `context7` | Library-docs lookup via Context7 MCP/API |
| `datadog` | ported to skill `datadog` | Datadog query/ops as a portable skill |
| `discord` | ported to skill `discord` | Discord messaging as a portable skill |
| `firestore` | removed — superseded by `firestore-cli` + skill | Same domain logic lived twice; the CLI + skill cover every harness including pi (npm @dreki-gg/pi-firestore@0.3.1 stays published, unmaintained) |
| `firestore-cli` | extracted to [jalbarrang/firestore-cli](https://github.com/jalbarrang/firestore-cli) | Standalone npm CLI consumed by skill `firestore`; no pi coupling, moved out with history |
| `handoff` | retired-superseded | Portable `handoff` skill already exists in the skills repo |
| `jira` | ported to skill `jira` | Jira via `acli` as a portable skill |
| `lsp` | not ported — dropped | Harness-native LSP (Cursor, editors) covers it; a portable one-shot skill was built, verified, and removed as not worth keeping |
| `past-chats` | stays pi-only | Tied to pi session JSONL format and `@chat:` / `@session:` editor tokens |
| `plan-mode` | retired — parity proven | planwork skill + taskman CLI (0.5.0: create-initiative, revise-plan) reproduce the full workflow on any harness; verified end-to-end by a zero-context cursor agent |
| `questionnaire` | retired — replaced by convention | planwork's batched clarification rule (≤5 enumerated questions in one message) replaces the TUI questionnaire outside pi |
| `slack` | ported to skill `slack` | Slack messaging as a portable skill |
| `subagent` | ported to skill `subagents` | Skill ports the workflow; pi extension also stays for pi sessions |
| `taskman` | extracted to [jalbarrang/taskman](https://github.com/jalbarrang/taskman) | Standalone plan ledger CLI consumed by `planwork` and `plan-mode` (now via npm ^0.4.0); moved out with history |
| `workflow` | `/commit` → skill `commit`; rest stays pi-only | Commit flow ports to skill `commit` (landing in this batch); remaining workflow helpers stay pi-only |

Nothing is deleted from `pi-extensions`. Pi keeps installing and running these packages during the migration; skills are additive ports (or supersessions) so other harnesses can use the same capabilities without loading a pi extension.
