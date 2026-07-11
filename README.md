# Pi Extensions

> **Archived.** These extensions are superseded by harness-agnostic skills at [jalbarrang/skills](https://github.com/jalbarrang/skills) and the standalone [jalbarrang/taskman](https://github.com/jalbarrang/taskman) CLI. Actively maintained extensions were extracted to their own repos (see below). See [MIGRATION.md](./MIGRATION.md) for the per-package disposition. Published `@dreki-gg/*` npm packages remain installable but unmaintained.

## Extracted to standalone repos

| Repo | Package |
|------|---------|
| [jalbarrang/pi-browser-tools](https://github.com/jalbarrang/pi-browser-tools) | `@dreki-gg/pi-browser-tools` |
| [jalbarrang/pi-code-reviewer](https://github.com/jalbarrang/pi-code-reviewer) | `@dreki-gg/pi-code-reviewer` |
| [jalbarrang/pi-command-sandbox](https://github.com/jalbarrang/pi-command-sandbox) | `@dreki-gg/pi-command-sandbox` |
| [jalbarrang/pi-datadog](https://github.com/jalbarrang/pi-datadog) | `@dreki-gg/pi-datadog` |
| [jalbarrang/pi-doc-search](https://github.com/jalbarrang/pi-doc-search) | `@dreki-gg/pi-doc-search` (renamed from `@dreki-gg/pi-context7`; tools now `doc_search_*`) |
| [jalbarrang/pi-handoff](https://github.com/jalbarrang/pi-handoff) | `@dreki-gg/pi-handoff` |
| [jalbarrang/pi-jira](https://github.com/jalbarrang/pi-jira) | `@dreki-gg/pi-jira` |
| [jalbarrang/pi-plan-mode](https://github.com/jalbarrang/pi-plan-mode) | `@dreki-gg/pi-plan-mode` |
| [jalbarrang/pi-slack](https://github.com/jalbarrang/pi-slack) | `@dreki-gg/pi-slack` |
| [jalbarrang/pi-subagent](https://github.com/jalbarrang/pi-subagent) | `@dreki-gg/pi-subagent` |
| [jalbarrang/pi-questionnaire](https://github.com/jalbarrang/pi-questionnaire) | `@dreki-gg/pi-questionnaire` |
| [jalbarrang/taskman](https://github.com/jalbarrang/taskman) | `@dreki-gg/taskman` |

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Each package is independently installable via `pi install`.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@dreki-gg/pi-ast-grep` | Structural (AST-based) code search/rewrite tool (`ast_grep`), powered by ast-grep | `pi install npm:@dreki-gg/pi-ast-grep` |
| `@dreki-gg/pi-context-folders` | Add sibling project folders as searchable context for pi agents | `pi install npm:@dreki-gg/pi-context-folders` |
| `@dreki-gg/pi-firestore` | Firestore debugging tools — query collections, inspect documents, map relationships | `pi install npm:@dreki-gg/pi-firestore` |
| `@dreki-gg/pi-past-chats` | Reference previous Pi sessions inline with `@chat:` / `@session:` autocomplete and injected handoff summaries | `pi install npm:@dreki-gg/pi-past-chats` |
| `@dreki-gg/pi-workflow` | Personal workflow helpers — `/commit` generates and creates a Conventional Commits commit | `pi install npm:@dreki-gg/pi-workflow` |

## Development

```bash
git clone https://github.com/dreki-gg/pi-extensions.git
cd pi-extensions
bun install
```
