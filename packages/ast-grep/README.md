# @dreki-gg/pi-ast-grep

Structural (AST-based) code search and rewrite tool for [pi](https://github.com/earendil-works/pi-coding-agent), powered by [`ast-grep`](https://ast-grep.github.io/).

Registers the `ast_grep` tool. Prefer it over text grep when matching code *shape* — call shapes like `console.log($A)`, function/class definitions, imports, or refactors.

## Requirements

`ast-grep` (alias `sg`) must be installed on your `PATH`.

## Parameters

- `pattern` — ast-grep pattern, e.g. `console.log($A)`
- `lang` — `ts`, `tsx`, `js`, `jsx`, `py`, `go`, `rust`, `java`, …
- `path` — file or dir to search (default `.`)
- `rewrite` — replacement pattern
- `updateAll` — apply the rewrite to disk (default false = dry-run diff)
