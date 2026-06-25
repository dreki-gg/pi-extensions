# Pi Extensions

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Each package is independently installable via `pi install`.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@dreki-gg/pi-browser-tools` | Browser automation + web research tools (`web_search`, `web_visit`, `web_screenshot`, `web_interact`, `web_console`) | `pi install npm:@dreki-gg/pi-browser-tools` |
| `@dreki-gg/pi-code-reviewer` | Multi-lens code review with configurable per-project review criteria | `pi install npm:@dreki-gg/pi-code-reviewer` |
| `@dreki-gg/pi-command-sandbox` | Shared command-sandboxing utilities — validates shell commands against safe/destructive pattern lists | `pi install npm:@dreki-gg/pi-command-sandbox` |
| `@dreki-gg/pi-context-folders` | Add sibling project folders as searchable context for pi agents | `pi install npm:@dreki-gg/pi-context-folders` |
| `@dreki-gg/pi-context7` | Pi-native Context7 docs tools — direct HTTP, persistent cache, no MCP | `pi install npm:@dreki-gg/pi-context7` |
| `@dreki-gg/pi-datadog` | Datadog log search tools — query production logs with project-aware context | `pi install npm:@dreki-gg/pi-datadog` |
| `@dreki-gg/pi-firestore` | Firestore debugging tools — query collections, inspect documents, map relationships | `pi install npm:@dreki-gg/pi-firestore` |
| `@dreki-gg/pi-jira` | Jira tools via an authenticated Atlassian CLI (`acli`) session — pull ticket context (`jira_view`, `jira_search`, `jira_comments`) and post concise comments (`jira_comment`) | `pi install npm:@dreki-gg/pi-jira` |
| `@dreki-gg/pi-past-chats` | Reference previous Pi sessions inline with `@chat:` / `@session:` autocomplete and injected handoff summaries | `pi install npm:@dreki-gg/pi-past-chats` |
| `@dreki-gg/pi-plan-mode` | Two-phase planning workflow with read-only planning and `.plans/` file-based handoff | `pi install npm:@dreki-gg/pi-plan-mode` |
| `@dreki-gg/pi-pr-canvas` | Visual GitHub PR canvas — self-contained HTML overview with file tree, diffs, CI checks, comments, and AI mind map | `pi install npm:@dreki-gg/pi-pr-canvas` |
| `@dreki-gg/pi-questionnaire` | Tool-first questionnaire flow + `/questionnaire` demo command | `pi install npm:@dreki-gg/pi-questionnaire` |
| `@dreki-gg/pi-slack` | Slack read tools — messages, threads, channels, search, and file/image downloads | `pi install npm:@dreki-gg/pi-slack` |
| `@dreki-gg/pi-subagent` | Subagent tool + `/run-agent` with bundled agents and workflow templates | `pi install npm:@dreki-gg/pi-subagent` |
| `@dreki-gg/taskman` | Standalone task-management engine + CLI over a `.plans/` JSONL ledger — the plan-mode core | `pi install npm:@dreki-gg/taskman` |

## Development

```bash
git clone https://github.com/dreki-gg/pi-extensions.git
cd pi-extensions
bun install
```
