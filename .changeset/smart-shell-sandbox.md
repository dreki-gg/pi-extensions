---
"@dreki-gg/pi-ask-mode": minor
"@dreki-gg/pi-plan-mode": minor
---

feat(ask-mode, plan-mode): support concatenated shell commands in sandbox validation

Commands using `&&`, `||`, and `;` operators are now parsed and validated per-segment instead of being blocked outright. Uses `shell-quote` for proper shell tokenization that respects quoted strings, subshells, and redirects.

Previously, safe commands like `cd src && ls -la` or `git status && git log` were incorrectly blocked because the sandbox only split on pipes (`|`). Now each segment is validated independently against the safe/destructive pattern lists.

Also adds `cd`, `basename`, `dirname`, `realpath`, `readlink`, and `bun pm ls` to the safe commands list, and blocks command substitution (`$(...)` and backticks) by default.

Shared sandbox logic extracted to private `@dreki-gg/pi-command-sandbox` package (bundled into published tarballs via `bundledDependencies`).
