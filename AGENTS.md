# Agents Instructions

## Codebase Practices

1. Use package.json scripts when possible.
2. Use `bun` package manager instead of `npm` / `pnpm` / `yarn`

## Publishing and Installing Packages

1. **NEVER install packages manually** on the local machine (no `npm install -g`, `bun add -g`, etc.). Released packages are installed via `pi install npm:@dreki-gg/<pkg>` and updated via `pi update` — the standard pi flow handles everything.
2. Publishing releases to the public npm registry goes through Changesets: `bun run version` then `bun run publish` (or `bun run deploy:public`). Confirm the publish succeeded; do not run any global install command.

### Local dev: path-install from this repo

For a local live-edit loop without publishing, install a package straight from its repo directory:

```bash
pi install /absolute/path/to/pi-extensions/packages/<pkg>
pi remove  /absolute/path/to/pi-extensions/packages/<pkg>
```

pi adds local paths to settings **without copying**, loads the directory with full package rules (reads `package.json` + `pi.extensions`, handles multi-file extensions), and resolves runtime deps from the repo's hoisted `node_modules` — so dependency-bound packages work too. Edits in the repo take effect on the next pi restart.

Notes: workspace-dependent packages (e.g. `plan-mode` → `command-sandbox`, `taskman`) require `bun run build` first so their `dist/` exists. Path installs are unversioned and skipped by `pi update`. This is the canonical local dev loop; publishing to npm (above) remains how releases reach other people.

## Creating and maintaining Pi Extensions

1. Avoid creating big index.ts files, advocate to separate logic in different files and folders to organize them.
2. Create extensions using a domain-driven approach to avoid huge files — group code by domain concepts and responsibilities.
3. Create extensions using a TDD approach to make sure that the code generated builds with the correct logic.
4. Prefer less code to avoid too many moving parts, but never take shortcuts — simplicity without sacrificing correctness.
5. Decide where a new extension lives by its shape, not by counting what already exists: a small, self-contained personal helper (a command or a tiny hook) with no real runtime dependencies goes inside the `workflow` package (add it under `extensions/<name>/` and list it in that package's `pi.extensions`). Give an extension its own package only when it has a distinct domain, real runtime dependencies, or is worth installing standalone.

### Runtime constraint: Extensions run on Node.js, not Bun

Pi loads extensions at runtime via [jiti](https://github.com/unjs/jiti) on **Node.js**. Even though this monorepo uses `bun` as package manager and test runner, **extension source code must not import Bun-specific modules** (e.g. `import { Glob } from 'bun'`, `import { serve } from 'bun'`). Use Node.js built-in APIs instead:

| Instead of (Bun)          | Use (Node.js)                                |
|---------------------------|----------------------------------------------|
| `Glob` from `'bun'`       | `readdir(path, { recursive: true })` from `'node:fs/promises'` |
| `Bun.file()`              | `readFile()` from `'node:fs/promises'`       |
| `Bun.write()`             | `writeFile()` from `'node:fs/promises'`      |
| `Bun.serve()`             | `createServer()` from `'node:http'`          |
| `Bun.spawn()`             | `spawn()` / `execFile()` from `'node:child_process'` |

**Test files** (`test/**/*.test.ts`) run under `bun test` and _can_ use Bun APIs freely — only the `extensions/` source that ships in the package must be Node-compatible.
