---
"@dreki-gg/pi-plan-mode": minor
"@dreki-gg/pi-browser-tools": patch
"@dreki-gg/pi-subagent": patch
"@dreki-gg/pi-lsp": patch
---

feat(plan-mode): add Windows compatibility — replace Unix shell commands with cross-platform Bun/Node APIs

Plan-mode no longer shells out to `cat`, `bash`, or `mkdir` via `pi.exec()`. File I/O now uses `Bun.file()` / `Bun.write()` and `node:fs/promises` `mkdir`, making the extension fully cross-platform. Destructive and safe command pattern lists now include Windows equivalents (`del`, `rd`, `copy`, `move`, `powershell`, `dir`, `where`, `tasklist`, etc.).

Also fixes Windows compatibility in three other packages:

- **browser-tools**: `spawn` now uses `shell: true` on Windows so `.cmd` wrappers resolve correctly; `shellEscape` uses double-quote style on Windows; install guidance is platform-aware (Homebrew shown only on macOS).
- **subagent**: `spawn` uses `shell: true` on Windows when the command is bare `pi`, allowing `pi.cmd` resolution.
- **lsp**: `globalConfigPath()` now uses `os.homedir()` on Windows instead of the unreliable `process.env.HOME`.
