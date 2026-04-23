# Pi Extensions

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Each package is independently installable via `pi install`.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@dreki-gg/pi-context7` | Pi-native Context7 docs tools (no MCP) | `pi install npm:@dreki-gg/pi-context7` |
| `@dreki-gg/pi-questionnaire` | Tool-first questionnaire flow + `/questionnaire` demo command | `pi install npm:@dreki-gg/pi-questionnaire` |
| `@dreki-gg/pi-subagent` | Subagent tool + `/run-agent` with bundled agents and workflow templates | `pi install npm:@dreki-gg/pi-subagent` |
| `@dreki-gg/pi-lsp` | LSP-powered code intelligence (TypeScript + oxlint) | `pi install npm:@dreki-gg/pi-lsp` |
| `@dreki-gg/pi-modes` | Config-driven preset/mode switching with hard-enforced tool whitelists | `pi install npm:@dreki-gg/pi-modes` |
| `@dreki-gg/pi-plan-mode` | Cursor-like plan workflow with read-only planning, domain-model handoffs, and implementation-plan generation | `pi install npm:@dreki-gg/pi-plan-mode` |
| `@dreki-gg/pi-vim-mode` | Always-on vim-like modal editor that preserves insert-mode autocomplete | `pi install npm:@dreki-gg/pi-vim-mode` |

## Development

```bash
git clone https://github.com/dreki-gg/pi-extensions.git
cd pi-extensions
bun install
```
