---
"@dreki-gg/pi-lsp": minor
---

Add Windows support for the LSP extension: spawn with `shell: true` on win32 for `.cmd` wrappers, use `where` instead of `which` for command lookup, normalize file URIs with `file:///` and forward slashes for drive-letter paths per RFC 8089, and fix `uriToPath` to correctly round-trip Windows URIs.
