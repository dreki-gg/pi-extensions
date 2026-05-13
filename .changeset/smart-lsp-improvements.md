---
"@dreki-gg/pi-lsp": minor
---

feat(lsp): improve reliability and LLM guidance based on real-world usage feedback

- **documentSymbol now includes column positions** — output shows `line:col` instead of just `line`, eliminating the need for a follow-up `rg --column` to get positions for other LSP operations.
- **Retry with backoff during server indexing** — `hover`, `definition`, `references`, `implementation`, `documentSymbol`, and `workspaceSymbol` automatically retry (up to 2 times, 2s delay) when the server was recently initialized and returns empty results.
- **Send `didSave` notification** — the client now sends `textDocument/didSave` after opening or updating documents, fixing diagnostics for servers like `rust-analyzer` that require save events.
- **Improved diagnostics wait logic** — stale cached diagnostics are cleared on document re-sync, and the arbitrary 500ms delay is removed in favor of resolving immediately when fresh diagnostics arrive.
- **Rewritten `promptGuidelines`** — 9 targeted guidelines that teach LLMs (especially smaller models) how to use LSP tools effectively: prefer `hover` for quick inspection, position cursor in the middle of symbols, use compiler tools for diagnostics in compiled languages, and more.
- **Enhanced tool description** — includes tips section and notes that `incomingCalls`/`outgoingCalls` auto-prepare the call hierarchy.
- **Removed unused code** — `pathToUri` export, `capabilities` getter, and `closeDocument` method removed.
