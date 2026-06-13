---
"@dreki-gg/pi-pr-canvas": patch
"@dreki-gg/pi-lsp": patch
---

Cross-platform fixes for Windows. PR Canvas now opens the browser via the
Windows `start` command instead of running `xdg-open` (which does not exist on
Windows), so `/pr-canvas start` and `/pr-canvas open` work there. The LSP client
derives the workspace folder name with `path.basename` instead of splitting on
`/`, fixing the name on Windows-style paths.
