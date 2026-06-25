# Agents Instructions

## Codebase Practices

1. Use package.json scripts when possible.
2. Use `bun` package manager instead of `npm` / `pnpm` / `yarn`

## Publishing and Installing Packages

1. **NEVER install packages manually** on the local machine (no `npm install -g`, `bun add -g`, etc.). After publishing to the local Verdaccio registry, packages are installed via `pi update` — the standard pi upgrade flow handles everything.
2. After `npm publish --registry http://localhost:4873`, just confirm the publish succeeded. Do not run any global install command.

### Alternative (dev only): symlink an extension into the user folder

For a local live-edit loop without republishing, use the cross-platform (Unix + Windows) helper to symlink self-contained extensions into `~/.pi/agent/extensions/`:

```bash
bun run link:user:list                  # show linkable packages + file names
bun run link:user ast-grep handoff      # link specific package(s)
bun run link:user ast-grep --force      # overwrite existing
bun run unlink:user workflow            # remove links for a package
```

Granular by design: you must name packages (or pass `--all` to opt into every package that declares `pi.extensions`). `scripts/link-extensions.mjs` (commander CLI) also supports `--dry-run` and `--dir <path>` (or `PI_EXTENSIONS_DIR`). On Windows it falls back to a copy when symlinks are denied — enable Developer Mode for live updates.

`--all` links every package, including multi-file/dependency ones that won't run as a bare symlink — prefer naming the self-contained single-file extensions.

pi loads `.ts` files in that folder directly, so edits in the repo take effect on the next pi restart — no publish, no `pi update`. Only link single-file extensions with no relative imports or runtime deps. This is a personal dev convenience only; it bypasses the Verdaccio flow above, which remains the canonical way others install these packages.

## Creating and maintaining Pi Extensions

1. Avoid creating big index.ts files, advocate to separate logic in different files and folders to organize them.
2. Create extensions using a domain-driven approach to avoid huge files — group code by domain concepts and responsibilities.
3. Create extensions using a TDD approach to make sure that the code generated builds with the correct logic.
4. Prefer less code to avoid too many moving parts, but never take shortcuts — simplicity without sacrificing correctness.

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
