# @dreki-gg/pi-lsp

## 0.2.1

### Patch Changes

- [`32797ff`](https://github.com/dreki-gg/pi-extensions/commit/32797ff18d968e22c6c44e95c46e3393d8928cef) Thanks [@jalbarrang](https://github.com/jalbarrang)! - feat(plan-mode): add Windows compatibility — replace Unix shell commands with cross-platform Bun/Node APIs

  Plan-mode no longer shells out to `cat`, `bash`, or `mkdir` via `pi.exec()`. File I/O now uses `Bun.file()` / `Bun.write()` and `node:fs/promises` `mkdir`, making the extension fully cross-platform. Destructive and safe command pattern lists now include Windows equivalents (`del`, `rd`, `copy`, `move`, `powershell`, `dir`, `where`, `tasklist`, etc.).

  Also fixes Windows compatibility in three other packages:

  - **browser-tools**: `spawn` now uses `shell: true` on Windows so `.cmd` wrappers resolve correctly; `shellEscape` uses double-quote style on Windows; install guidance is platform-aware (Homebrew shown only on macOS).
  - **subagent**: `spawn` uses `shell: true` on Windows when the command is bare `pi`, allowing `pi.cmd` resolution.
  - **lsp**: `globalConfigPath()` now uses `os.homedir()` on Windows instead of the unreliable `process.env.HOME`.

## 0.2.0

### Minor Changes

- [`d1c6d0b`](https://github.com/dreki-gg/pi-extensions/commit/d1c6d0b7da843700a7381790d9323f78dd26b152) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add Windows support for the LSP extension: spawn with `shell: true` on win32 for `.cmd` wrappers, use `where` instead of `which` for command lookup, normalize file URIs with `file:///` and forward slashes for drive-letter paths per RFC 8089, and fix `uriToPath` to correctly round-trip Windows URIs.

## 0.1.3

### Patch Changes

- [`d133c3d`](https://github.com/dreki-gg/pi-extensions/commit/d133c3da917e7e5def568d27d6cde8ae8a6c00d2) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Mark pi peer dependencies as optional so npm does not auto-install pi internals when installing extension packages.

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
