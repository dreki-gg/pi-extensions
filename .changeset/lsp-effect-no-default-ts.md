---
'@dreki-gg/pi-lsp': minor
---

refactor(lsp): adopt Effect and stop enabling TypeScript by default

- **Effect-based architecture** — config loading, scaffolding, and the unified `lsp` tool now run as Effect programs against injectable services (`FileSystem`, `CommandResolver`, `ServerManager`). Failures are modeled as `Data.TaggedError` types (`ConfigReadError`, `ConfigWriteError`, `LspValidationError`, `NoCapableServerError`, `NoServerAvailableError`, `LspOperationError`), mirroring the firestore package's conventions. Promise-returning wrappers keep the public API stable.
- **TypeScript is no longer a default server** — the scaffolded starter config now ships TypeScript, Python, Rust, and Go as `disabled` examples. No language server is spawned until the user explicitly opts in, so the extension never auto-starts `typescript-language-server` on a fresh setup.
- New service-injection tests cover config resolution (global/npx/unavailable command paths) and scaffolding without touching disk or the shell.
