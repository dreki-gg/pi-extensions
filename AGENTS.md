# Agents Instructions

## Codebase Practices

1. Use package.json scripts when possible.
2. Use `bun` package manager instead of `npm` / `pnpm` / `yarn`

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
