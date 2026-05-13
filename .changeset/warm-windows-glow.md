---
"@dreki-gg/pi-lsp": patch
---

fix(lsp): Windows URI normalization and diagnostic waiter race conditions

- Add `normalizeUri()` to decode percent-encoded URIs (`%3A` → `:`) and uppercase Windows drive letters, fixing key mismatches between `pathToUri` and server responses.
- `pathToUri()` now always uppercases the drive letter for consistency.
- `uriToPath()` now applies `decodeURIComponent` so encoded URIs from the server produce valid file paths.
- Replace per-URI waiter arrays with a single `PendingDiagnostic` promise per URI, eliminating manual timer/splice management.
- Track `invalidatedUris` to distinguish first-open (empty diagnostics = clean file → resolve immediately) from re-open (empty diagnostics = server clearing stale state → wait for real results).
