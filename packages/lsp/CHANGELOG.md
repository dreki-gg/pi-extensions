# @dreki-gg/pi-lsp

## 0.1.2

### Patch Changes

- [`0be7b68`](https://github.com/dreki-gg/pi-extensions/commit/0be7b6877e9874b46c756b58c99d599db623ef11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Migrate TypeBox usage and session replacement flows for Pi 0.69 compatibility.

  - switch extension imports from `@sinclair/typebox` to `typebox`
  - update package peer dependencies to require `typebox`
  - move subagent `/run-agent` fork-at follow-up work into `withSession` so post-fork operations use the replacement session safely
  - add command argument completions for `/run-agent`, `/delegate-agents`, `/preset`, `/mode`, and `/plan`
  - align local development dependencies with Pi 0.69 for typechecking and compatibility checks

## 0.1.1

### Patch Changes

- [`2a5bccb`](https://github.com/dreki-gg/pi-extensions/commit/2a5bccb2d2d663574d03e6e72bf6fcb2cdabc051) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Fix stale LSP footer status so it stays in sync with detected/configured servers.

  - refresh footer status on session start from the resolved config
  - refresh footer status when running `/lsp`
  - refresh footer status after `/lsp-restart`
  - refresh footer status after `lsp` tool execution so running servers are reflected in the UI
