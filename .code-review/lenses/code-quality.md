# Code Quality

Review the diff for correctness, runtime-safety, and adherence to this monorepo's
hard constraints. This is a collection of independently installable **pi extension
packages** (`packages/*`) written in TypeScript, using `effect`, bundled/run on
**Node.js** at runtime via jiti, with `bun` as the package manager and test runner.

## Tools

- `bun run lint`
- `bun run typecheck`

## Criteria

### Node.js runtime constraint (highest priority)

Shipped extension source under `packages/*/extensions/**` runs on **Node.js**, NOT Bun.
Flag any of these in extension source:

- `import { ... } from 'bun'` (e.g. `Glob`, `serve`, `spawn`) — must use Node built-ins:
  `readdir(path, { recursive: true })` from `node:fs/promises` instead of `Glob`,
  `readFile`/`writeFile` from `node:fs/promises` instead of `Bun.file()`/`Bun.write()`,
  `createServer` from `node:http` instead of `Bun.serve()`,
  `spawn`/`execFile` from `node:child_process` instead of `Bun.spawn()`.
- Bare global use of `Bun.*` anywhere outside `test/**/*.test.ts`.
- Test files (`test/**/*.test.ts`) MAY use Bun APIs — do not flag those.

### Effect usage

- Promise-based or `try/catch` error handling introduced where the surrounding module
  uses `effect` — prefer `Effect`-native error channels for consistency.
- Unhandled/swallowed errors, `any` casts that defeat Effect's typed errors.

### Correctness smells in the diff

- Missing `await`, floating promises, unhandled rejections.
- `console.log` / debug logging left in shipped extension code.
- Off-by-one or boundary bugs in editor/buffer logic (modal editor operates on
  **logical lines**, not terminal-wrapped display lines — flag display-line assumptions).
- New `peerDependencies` added without a matching `peerDependenciesMeta.optional` entry
  when the dependency is optional, diverging from the package convention.

### Lint / format

- Unused variables/imports (`@typescript-eslint/no-unused-vars` is `warn`).
- Code that would fail `oxfmt` (semicolons, single quotes, 100-col print width, 2-space indent).
