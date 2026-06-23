# Pi Extensions

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Each package is independently installable via `pi install`.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@dreki-gg/pi-browser-tools` | Browser automation + web research tools (`web_search`, `web_visit`, `web_screenshot`, `web_interact`, `web_console`) | `pi install npm:@dreki-gg/pi-browser-tools` |
| `@dreki-gg/pi-context7` | Pi-native Context7 docs tools (no MCP) | `pi install npm:@dreki-gg/pi-context7` |
| `@dreki-gg/pi-questionnaire` | Tool-first questionnaire flow + `/questionnaire` demo command | `pi install npm:@dreki-gg/pi-questionnaire` |
| `@dreki-gg/pi-subagent` | Subagent tool + `/run-agent` with bundled agents and workflow templates | `pi install npm:@dreki-gg/pi-subagent` |
| `@dreki-gg/pi-lsp` | LSP-powered code intelligence (TypeScript + oxlint) | `pi install npm:@dreki-gg/pi-lsp` |
| `@dreki-gg/pi-modes` | Config-driven preset/mode switching with hard-enforced tool whitelists | `pi install npm:@dreki-gg/pi-modes` |
| `@dreki-gg/pi-plan-mode` | Cursor-like plan workflow with read-only planning, domain-model handoffs, and implementation-plan generation | `pi install npm:@dreki-gg/pi-plan-mode` |
| `@dreki-gg/pi-past-chats` | Reference previous Pi sessions inline with `@chat:` / `@session:` autocomplete and injected handoff summaries | `pi install npm:@dreki-gg/pi-past-chats` |
| `@dreki-gg/pi-miro` | Create native Miro items — shapes, connectors, frames, and auto-laid-out diagrams (dagre) on an existing board | `pi install npm:@dreki-gg/pi-miro` |
| `@dreki-gg/pi-jira` | Jira tools via an authenticated Atlassian CLI (`acli`) session — pull ticket context (`jira_view`, `jira_search`, `jira_comments`) and post concise comments (`jira_comment`) | `pi install npm:@dreki-gg/pi-jira` |

## Development

```bash
git clone https://github.com/dreki-gg/pi-extensions.git
cd pi-extensions
bun install
```
