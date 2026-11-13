# Pi Extensions

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Each package is independently installable via `pi install`.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@dreki-gg/pi-context-folders` | Add sibling project folders as searchable context for pi agents | `pi install npm:@dreki-gg/pi-context-folders` |
| `@dreki-gg/pi-discord` | Discord read tools — pull channel messages and attachments for agent context | `pi install npm:@dreki-gg/pi-discord` |
| `@dreki-gg/pi-past-chats` | Reference previous Pi sessions inline with `@chat:` / `@session:` autocomplete and injected handoff summaries | `pi install npm:@dreki-gg/pi-past-chats` |
| `@dreki-gg/pi-workflow` | Personal workflow helpers — `/commit` generates and creates a Conventional Commits commit | `pi install npm:@dreki-gg/pi-workflow` |

## Development

```bash
git clone https://github.com/dreki-gg/pi-extensions.git
cd pi-extensions
bun install
```
