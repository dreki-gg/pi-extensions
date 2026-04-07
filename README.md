# Pi Extensions

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Each package is independently installable via `pi install`.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@dreki-gg/pi-context7` | Pi-native Context7 docs tools (no MCP) | `pi install npm:@dreki-gg/pi-context7` |
| `@dreki-gg/pi-questionnaire` | Tool-first questionnaire flow + `/questionnaire` demo command | `pi install npm:@dreki-gg/pi-questionnaire` |
| `@dreki-gg/pi-subagent` | Subagent tool + `/delegate` orchestration with bundled agents and workflow presets | `pi install npm:@dreki-gg/pi-subagent` |
| `@dreki-gg/pi-lsp` | LSP-powered code intelligence (TypeScript + oxlint) | `pi install npm:@dreki-gg/pi-lsp` |
| `@dreki-gg/pi-modes` | Config-driven preset/mode switching with hard-enforced tool whitelists | `pi install npm:@dreki-gg/pi-modes` |

## Development

```bash
git clone https://github.com/dreki-gg/pi-extensions.git
cd pi-extensions
bun install
```
