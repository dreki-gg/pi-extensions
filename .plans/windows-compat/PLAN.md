# Windows Compatibility for pi-extensions

Add Windows compatibility to four extension packages: **plan-mode** (critical), **browser-tools** (moderate), **subagent** (minor), and **lsp** (minor). Use Bun-native file APIs (`Bun.file()`, `Bun.write()`) where we're adding new file I/O code.

## Context

The monorepo has 7 extension packages in `packages/`. Three are already cross-platform (context7, questionnaire, modes). The remaining four use Unix-specific patterns:

- **plan-mode** — Uses `pi.exec('cat', [...])`, `pi.exec('bash', ['-c', ...])`, and `pi.exec('mkdir', ['-p', ...])` throughout. These commands don't exist on Windows.
- **browser-tools** — `spawn()` without `shell: true` won't resolve `.cmd` wrappers on Windows; shell escaping uses Unix single-quote style.
- **subagent** — Fallback `{ command: 'pi', args }` path needs `shell: true` or `.cmd` awareness on Windows.
- **lsp** — `process.env.HOME` is unreliable on Windows (should prefer `homedir()`).

### Bun API strategy

Pi runs on Bun. Currently only `packages/lsp` has `bun-types` in its devDependencies/tsconfig. The other packages use `@types/node`.

For **plan-mode** (the package with the most new file I/O code), we'll:
1. Add `bun-types` to devDependencies and tsconfig
2. Use `Bun.file(path).text()` instead of `readFile(path, 'utf8')`
3. Use `Bun.write(path, content)` instead of `writeFile(path, content)`
4. Keep `mkdir` from `node:fs/promises` (Bun has no equivalent for recursive mkdir)

For **browser-tools**, **subagent**, and **lsp**, we're making small surgical spawn/config changes — no new file I/O, so no API migration needed.

### Key files

- `packages/plan-mode/extensions/plan-mode/index.ts` — 7 `pi.exec()` calls using `cat`, `bash`, `mkdir`
- `packages/plan-mode/extensions/plan-mode/plans-json.ts` — `exec('cat', [PLANS_JSON])` to read manifest
- `packages/plan-mode/extensions/plan-mode/utils.ts` — safe/destructive command lists (Unix-only)
- `packages/plan-mode/package.json` — needs `bun-types` devDep
- `packages/plan-mode/tsconfig.json` — needs `"types": ["bun-types"]`
- `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts` — `spawn()` + `shellEscape()`
- `packages/subagent/extensions/subagent/spawn-utils.ts` — `getPiInvocation()` fallback + `spawn()`
- `packages/lsp/extensions/lsp/config.ts` — `process.env.HOME ?? homedir()` ordering

## Plan:

### 1. plan-mode: Add `bun-types` to package config

**File:** `packages/plan-mode/package.json`
Add `"bun-types": "latest"` to `devDependencies`.

**File:** `packages/plan-mode/tsconfig.json`
Add `"types": ["bun-types"]` to `compilerOptions`.

Run `bun install` from repo root.

### 2. plan-mode index.ts — Replace `pi.exec('cat', ...)` reads with `Bun.file().text()`

**File:** `packages/plan-mode/extensions/plan-mode/index.ts`

Add `import { mkdir } from 'node:fs/promises';` at the top (for directory creation only — Bun has no mkdir).

Replace all 4 `pi.exec('cat', [path])` calls (lines ~422, ~435, ~503, ~519) with `await Bun.file(path).text()`. Each follows this pattern:

```ts
// Before:
try {
  const result = await pi.exec('cat', [path]);
  if (result.code === 0) {
    title = extractPlanTitle(result.stdout);
  }
} catch { /* Fall through */ }

// After:
try {
  const content = await Bun.file(path).text();
  title = extractPlanTitle(content);
} catch { /* Fall through */ }
```

### 3. plan-mode index.ts — Replace `mkdir` + `bash` write with `mkdir` + `Bun.write()`

**File:** `packages/plan-mode/extensions/plan-mode/index.ts` (lines ~125-128 in `updatePlansManifest`)

Replace:
```ts
await pi.exec('mkdir', ['-p', '.plans']);
const content = serializePlansJson(manifest);
await pi.exec('bash', ['-c', `cat > .plans/plans.json << 'PLANS_EOF'\n${content}PLANS_EOF`]);
```

With:
```ts
await mkdir('.plans', { recursive: true });
const content = serializePlansJson(manifest);
await Bun.write('.plans/plans.json', content);
```

### 4. plan-mode index.ts — Update `readPlansJson` call site

**File:** `packages/plan-mode/extensions/plan-mode/index.ts` (line ~114)

Change:
```ts
const manifest = await readPlansJson((cmd, args) => pi.exec(cmd, args));
```
To:
```ts
const manifest = await readPlansJson();
```

### 5. plan-mode plans-json.ts — Replace `exec` callback with `Bun.file().text()`

**File:** `packages/plan-mode/extensions/plan-mode/plans-json.ts`

Remove the `exec` parameter and use Bun's file API directly:

```ts
// Before:
export async function readPlansJson(exec: (cmd: string, args: string[]) => Promise<{ code: number; stdout: string }>): Promise<PlansManifest> {
  try {
    const result = await exec('cat', [PLANS_JSON]);
    if (result.code === 0 && result.stdout.trim()) {
      return JSON.parse(result.stdout) as PlansManifest;
    }
  } catch { }
  return {};
}

// After:
export async function readPlansJson(): Promise<PlansManifest> {
  try {
    const file = Bun.file(PLANS_JSON);
    if (await file.exists()) {
      const text = await file.text();
      if (text.trim()) {
        return JSON.parse(text) as PlansManifest;
      }
    }
  } catch {
    // File doesn't exist or isn't valid JSON
  }
  return {};
}
```

Note: `Bun.file(path).exists()` avoids a throw on missing file, which is cleaner than try/catch around `.text()`.

### 6. plan-mode utils.ts — Add Windows-equivalent safe/destructive patterns

**File:** `packages/plan-mode/extensions/plan-mode/utils.ts`

**Add to `DESTRUCTIVE_PATTERNS` array** (after the last entry before `]`):
```ts
  // Windows equivalents
  /\bdel\b/i,
  /\brd\b/i,
  /\bcopy\b/i,
  /\bmove\b/i,
  /\bren\b/i,
  /\brename\b/i,
  /\bicacls\b/i,
  /\battrib\b/i,
  /\bpowershell\b/i,
  /\bpwsh\b/i,
```

**Add to `SAFE_PATTERNS` array** (after the last entry before `]`):
```ts
  // Windows equivalents
  /^\s*dir\b/,
  /^\s*where\b/,
  /^\s*set\b/,
  /^\s*systeminfo\b/,
  /^\s*tasklist\b/,
```

### 7. browser-tools: Add `shell: true` on Windows for `spawn`

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

In `runAgentBrowser()` (~line 53), add `shell` option:

```ts
const child = spawn(AGENT_BROWSER_BIN, finalArgs, {
  cwd: options.cwd,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});
```

### 8. browser-tools: Make `shellEscape` platform-aware

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

Replace:
```ts
function shellEscape(value: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/u.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}
```

With:
```ts
function shellEscape(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/u.test(value)) return value;
  if (process.platform === 'win32') {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
```

### 9. browser-tools: Update install guidance for cross-platform

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

Replace the `AGENT_BROWSER_INSTALL_GUIDANCE` constant:
```ts
const AGENT_BROWSER_INSTALL_GUIDANCE = [
  'agent-browser backend selected, but the CLI is unavailable.',
  'Install with one of:',
  ...(process.platform === 'darwin'
    ? ['  brew install agent-browser && agent-browser install', 'or']
    : []),
  '  npm install -g agent-browser && agent-browser install',
].join('\n');
```

Also update the install hints in `createSpawnError`:
```ts
'Install with one of:',
...(process.platform === 'darwin'
  ? ['  brew install agent-browser && agent-browser install']
  : []),
'  npm install -g agent-browser && agent-browser install',
```

### 10. subagent: Add `shell: true` on Windows for bare `pi` command

**File:** `packages/subagent/extensions/subagent/spawn-utils.ts`

Find (~line 117):
```ts
const proc = spawn(invocation.command, invocation.args, {
  cwd: options.cwd,
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

Replace with:
```ts
const needsShell = process.platform === 'win32' && invocation.command === 'pi';
const proc = spawn(invocation.command, invocation.args, {
  cwd: options.cwd,
  shell: needsShell,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

### 11. lsp: Prefer `homedir()` over `process.env.HOME`

**File:** `packages/lsp/extensions/lsp/config.ts` (line ~24)

Change:
```ts
return join(process.env.HOME ?? homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```
To:
```ts
return join(homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```

### 12. Run full test suite and verify

Run `bun install` then `bun test` at the repo root. All existing tests must pass:
- `test/pi-compat.test.ts` — integration harness for all extensions
- `packages/lsp/test/*.test.ts` — LSP-specific tests

The plan-mode compat test should still pass since it never actually invoked `pi.exec('cat', ...)` — it only tests tool registration, active tools, and tool blocking.

## Risks / Open Questions

1. **`Bun.file()` on missing files**: `Bun.file(path).text()` throws `ENOENT` on missing files. We use `Bun.file(path).exists()` in `plans-json.ts` to guard against this. The `index.ts` reads are already wrapped in try/catch, so they handle missing files gracefully.

2. **`Bun.write()` behavior**: `Bun.write(path, content)` creates parent directories if the file already exists, but does NOT auto-create parent dirs for brand-new paths. That's why we keep the `mkdir('.plans', { recursive: true })` call before `Bun.write('.plans/plans.json', ...)`.

3. **`bun-types` in plan-mode**: Adding `bun-types` means the package's TypeScript now recognizes the `Bun` global. This is safe since Pi always runs on Bun. The `bin/clean-plans.js` file is plain JS and uses `node:fs` — leave it as-is (it runs via `npx` which may use Node).

4. **No Windows CI**: Changes are defensive (`process.platform` checks, cross-platform APIs) and won't break Unix. True Windows validation requires a Windows runner.

5. **`shell: true` security**: Using `shell: true` on Windows opens potential injection if args contain metacharacters. browser-tools and subagent args are internally constructed (not user-supplied), so this is low risk.
