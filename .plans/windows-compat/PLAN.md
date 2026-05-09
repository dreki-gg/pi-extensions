# Windows Compatibility for pi-extensions

Add Windows compatibility to the four extension packages that currently have platform-specific issues: **plan-mode** (critical), **browser-tools** (moderate), **subagent** (minor), and **lsp** (minor).

## Context

The monorepo has 7 extension packages in `packages/`. Three are already cross-platform (context7, questionnaire, modes). The remaining four use Unix-specific patterns:

- **plan-mode** — Uses `pi.exec('cat', [...])`, `pi.exec('bash', ['-c', ...])`, and `pi.exec('mkdir', ['-p', ...])` throughout. These commands don't exist on Windows.
- **browser-tools** — `spawn()` without `shell: true` won't resolve `.cmd` wrappers on Windows; shell escaping uses Unix single-quote style.
- **subagent** — Fallback `{ command: 'pi', args }` path needs `shell: true` or `.cmd` awareness on Windows.
- **lsp** — `process.env.HOME` is unreliable on Windows (should prefer `homedir()`).

Key files analyzed:
- `packages/plan-mode/extensions/plan-mode/index.ts` — 7 `pi.exec()` calls using `cat`, `bash`, `mkdir`
- `packages/plan-mode/extensions/plan-mode/plans-json.ts` — `exec('cat', [PLANS_JSON])` to read manifest
- `packages/plan-mode/extensions/plan-mode/utils.ts` — safe/destructive command lists (Unix-only)
- `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts` — `spawn()` + `shellEscape()`
- `packages/subagent/extensions/subagent/spawn-utils.ts` — `getPiInvocation()` fallback + `spawn()`
- `packages/lsp/extensions/lsp/config.ts` — `process.env.HOME ?? homedir()` ordering
- `packages/lsp/extensions/lsp/protocol.ts` — already has `shell: process.platform === 'win32'` ✓
- `packages/lsp/extensions/lsp/client.ts` — already has backslash normalization + Windows drive detection ✓

The pi SDK's `getAgentDir()` already handles cross-platform home directories. Extensions that use it (context7, modes, subagent agents) are fine on that front.

## Plan:

### 1. plan-mode: Replace `pi.exec('cat', ...)` reads with `node:fs/promises` `readFile`

**File:** `packages/plan-mode/extensions/plan-mode/index.ts`

Replace all 4 `pi.exec('cat', [path])` calls (lines ~422, ~435, ~503, ~519) with direct `readFile(path, 'utf8')` from `node:fs/promises`. Each call follows the same pattern:

```ts
// Before
const result = await pi.exec('cat', [path]);
if (result.code === 0) { /* use result.stdout */ }

// After
const content = await readFile(path, 'utf8');
```

Wrap each in try/catch to match existing error-swallowing behavior.

### 2. plan-mode: Replace `pi.exec('mkdir', ...)` + `pi.exec('bash', ...)` write with `node:fs`

**File:** `packages/plan-mode/extensions/plan-mode/index.ts` (lines ~125-128 in `updatePlansManifest`)

Replace:
```ts
await pi.exec('mkdir', ['-p', '.plans']);
await pi.exec('bash', ['-c', `cat > .plans/plans.json << 'PLANS_EOF'\n${content}PLANS_EOF`]);
```

With:
```ts
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.plans', { recursive: true });
await writeFile('.plans/plans.json', content, 'utf8');
```

### 3. plan-mode: Replace `exec('cat', ...)` in `plans-json.ts` with `readFile`

**File:** `packages/plan-mode/extensions/plan-mode/plans-json.ts`

Change the `readPlansJson` function signature and implementation. Instead of accepting an `exec` callback, read the file directly:

```ts
import { readFile } from 'node:fs/promises';

export async function readPlansJson(): Promise<PlansManifest> {
  try {
    const text = await readFile('.plans/plans.json', 'utf8');
    if (text.trim()) return JSON.parse(text) as PlansManifest;
  } catch { /* file missing or invalid */ }
  return {};
}
```

Update the call site in `index.ts` (line ~114) from `readPlansJson((cmd, args) => pi.exec(cmd, args))` to just `readPlansJson()`.

### 4. plan-mode: Add Windows-equivalent safe/destructive patterns in `utils.ts`

**File:** `packages/plan-mode/extensions/plan-mode/utils.ts`

Add Windows equivalents to the destructive and safe pattern lists:

**Destructive patterns** — add:
- `/\bdel\b/i` (Windows `del`)
- `/\brddir\b/i` (Windows `rd` / `rmdir`)
- `/\bcopy\b/i` (Windows `copy`)
- `/\bmove\b/i` (Windows `move`)
- `/\bren\b/i` (Windows `ren` / `rename`)
- `/\bicacls\b/i` (Windows permissions)
- `/\battrib\b/i` (Windows `attrib`)
- `/\bpowershell\b/i`, `/\bpwsh\b/i`

**Safe patterns** — add:
- `/^\s*type\b/` — already present (works on Windows too)
- `/^\s*dir\b/` (Windows `dir` = `ls`)
- `/^\s*where\b/` (Windows `where` = `which`)
- `/^\s*set\b/` (Windows `set` = `env`)
- `/^\s*systeminfo\b/`
- `/^\s*tasklist\b/` (Windows `tasklist` = `ps`)

### 5. browser-tools: Add `shell: true` on Windows for `spawn`

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

In `runAgentBrowser()` (line ~53), add `shell: process.platform === 'win32'` to the spawn options:

```ts
const child = spawn(AGENT_BROWSER_BIN, finalArgs, {
  cwd: options.cwd,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});
```

### 6. browser-tools: Make `shellEscape` platform-aware

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

The current `shellEscape` uses Unix single-quote escaping. Make it platform-aware:

```ts
function shellEscape(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/u.test(value)) return value;
  if (process.platform === 'win32') {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
```

### 7. browser-tools: Add Windows install guidance

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

Update `AGENT_BROWSER_INSTALL_GUIDANCE` and `createSpawnError` to include Windows paths:

```ts
const AGENT_BROWSER_INSTALL_GUIDANCE = [
  'agent-browser backend selected, but the CLI is unavailable.',
  'Install with one of:',
  process.platform === 'darwin'
    ? '  brew install agent-browser && agent-browser install'
    : undefined,
  '  npm install -g agent-browser && agent-browser install',
].filter(Boolean).join('\n');
```

Apply the same fix to the install hints array in `createSpawnError`.

### 8. subagent: Add `shell: true` on Windows for the `'pi'` fallback path

**File:** `packages/subagent/extensions/subagent/spawn-utils.ts`

In `spawnPiAgent()` (line ~117), the spawn call currently uses `shell: false`. When the command resolves to bare `'pi'`, Windows needs `shell: true` to find `pi.cmd`. Change:

```ts
const proc = spawn(invocation.command, invocation.args, {
  cwd: options.cwd,
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

To:

```ts
const needsShell = process.platform === 'win32' && invocation.command === 'pi';
const proc = spawn(invocation.command, invocation.args, {
  cwd: options.cwd,
  shell: needsShell,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

### 9. lsp: Prefer `homedir()` over `process.env.HOME`

**File:** `packages/lsp/extensions/lsp/config.ts` (line ~24)

Change:
```ts
return join(process.env.HOME ?? homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```

To:
```ts
return join(homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```

`os.homedir()` already uses `USERPROFILE` / `HOMEDRIVE+HOMEPATH` on Windows and `HOME` on Unix. It's the correct cross-platform API.

### 10. Update tests for the `plans-json.ts` signature change

**File:** `test/pi-compat.test.ts`

The plan-mode compat test uses a mock `pi.exec()` that throws. After step 3, `readPlansJson` no longer calls `pi.exec`, so no test changes are needed for that. However, verify the existing plan-mode test still passes since we removed the `exec` dependency.

Also add a targeted unit test in `packages/plan-mode/` (new file `test/plans-json.test.ts`) that exercises `readPlansJson()` with a temp directory containing a valid `plans.json`, and one where the file is missing.

### 11. Run full test suite and verify

Run `bun test` at the repo root to confirm all existing tests still pass after these changes. Specifically:
- `test/pi-compat.test.ts` — integration harness for all extensions
- `packages/lsp/test/config.test.ts` — config path resolution tests

## Risks / Open Questions

1. **`pi.exec` vs direct `fs` in plan-mode**: The original code used `pi.exec('cat', ...)` presumably to go through pi's execution layer. Replacing with direct `readFile` bypasses that layer. This should be fine since these are internal reads of the extension's own plan files, not user-facing tool calls.

2. **Windows CI**: This repo doesn't appear to have Windows CI. The changes are defensive (`process.platform` checks, cross-platform Node APIs) and won't break Unix. But true Windows validation requires a Windows test runner.

3. **`shell: true` security on Windows**: Using `shell: true` on Windows for spawn opens potential command injection if args contain shell metacharacters. The browser-tools and subagent args are internally constructed (not user-supplied), so this is low risk.

4. **plan-mode `utils.ts` safe commands**: The safe/destructive pattern lists are a best-effort heuristic. Windows has many more shell builtins. The additions cover the most common equivalents.
