---
"@dreki-gg/pi-lsp": patch
---

Fix stale LSP footer status so it stays in sync with detected/configured servers.

- refresh footer status on session start from the resolved config
- refresh footer status when running `/lsp`
- refresh footer status after `/lsp-restart`
- refresh footer status after `lsp` tool execution so running servers are reflected in the UI
