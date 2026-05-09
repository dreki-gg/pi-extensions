# Windows Compatibility Refactor — Execution Prompt

You are implementing Windows compatibility fixes across 4 extension packages in a pi-extensions monorepo. The repo root is the current working directory.

## Repo Structure

```
packages/
  browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts
  context7/        (no changes needed)
  lsp/extensions/lsp/config.ts
  lsp/extensions/lsp/protocol.ts   (already Windows-aware, no changes)
  lsp/extensions/lsp/client.ts     (already Windows-aware, no changes)
  modes/           (no changes needed)
  plan-mode/extensions/plan-mode/index.ts
  plan-mode/extensions/plan-mode/plans-json.ts
  plan-mode/extensions/plan-mode/utils.ts
  questionnaire/   (no changes needed)
  subagent/extensions/subagent/spawn-utils.ts
test/pi-compat.test.ts             (integration tests for all extensions)
```

## Critical Constraints

- Use `edit` tool for all changes (not `write`) — these are surgical edits to existing files.
- Preserve all existing behavior on Unix/macOS. Windows fixes must be additive (`process.platform` checks, cross-platform Node APIs).
- The pi SDK's `getAgentDir()` already handles cross-platform home dirs — do NOT change extensions that use it.
- Run `bun test` after all changes to verify nothing breaks.
- Mark each step done with `[DONE:n]` after completing it.

---

## Steps

### Step 1: plan-mode index.ts — Replace `pi.exec('cat', ...)` reads with `readFile`

**File:** `packages/plan-mode/extensions/plan-mode/index.ts`

Add `import { readFile, mkdir as mkdirFs, writeFile as writeFileFs } from 'node:fs/promises';` at the top (after the existing imports).

Find all 4 occurrences of this pattern:
```ts
const result = await pi.exec('cat', [somePathVar]);
if (result.code === 0) { /* use result.stdout */ }
```

They appear at approximately:
- Line ~422: reading PLAN.md to extract title (inside `tool_result` handler)
- Line ~435: reading PLAN.md for title update
- Line ~503: reading planMdPath for todo extraction
- Line ~519: reading startPromptPath for clean handoff

Replace each with:
```ts
const content = await readFile(somePathVar, 'utf8');
// use `content` where `result.stdout` was used
```

Keep the existing `try/catch` wrappers. Where the code checked `result.code === 0`, just use the try/catch for error handling (readFile throws on missing file).

**Example for line ~422:**
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
  const content = await readFile(path, 'utf8');
  title = extractPlanTitle(content);
} catch { /* Fall through */ }
```

Apply the same transformation to all 4 sites.

### Step 2: plan-mode index.ts — Replace `mkdir` + `bash` write with Node fs

**File:** `packages/plan-mode/extensions/plan-mode/index.ts`

Find the `updatePlansManifest` function body (around lines 125-128):
```ts
await pi.exec('mkdir', ['-p', '.plans']);
const content = serializePlansJson(manifest);
await pi.exec('bash', ['-c', `cat > .plans/plans.json << 'PLANS_EOF'\n${content}PLANS_EOF`]);
```

Replace with:
```ts
await mkdirFs('.plans', { recursive: true });
const content = serializePlansJson(manifest);
await writeFileFs('.plans/plans.json', content, 'utf8');
```

(Using the `mkdirFs` and `writeFileFs` aliases from the import added in Step 1, to avoid name collisions if `mkdir` or `writeFile` are used elsewhere.)

### Step 3: plan-mode plans-json.ts — Replace `exec` callback with direct `readFile`

**File:** `packages/plan-mode/extensions/plan-mode/plans-json.ts`

Current signature:
```ts
export async function readPlansJson(exec: (cmd: string, args: string[]) => Promise<{ code: number; stdout: string }>): Promise<PlansManifest> {
  try {
    const result = await exec('cat', [PLANS_JSON]);
    if (result.code === 0 && result.stdout.trim()) {
      return JSON.parse(result.stdout) as PlansManifest;
    }
  } catch { }
  return {};
}
```

Replace with:
```ts
import { readFile } from 'node:fs/promises';

export async function readPlansJson(): Promise<PlansManifest> {
  try {
    const text = await readFile(PLANS_JSON, 'utf8');
    if (text.trim()) {
      return JSON.parse(text) as PlansManifest;
    }
  } catch {
    // File doesn't exist or isn't valid JSON
  }
  return {};
}
```

Then update the call site in `packages/plan-mode/extensions/plan-mode/index.ts` (line ~114):
```ts
// Before:
const manifest = await readPlansJson((cmd, args) => pi.exec(cmd, args));

// After:
const manifest = await readPlansJson();
```

### Step 4: plan-mode utils.ts — Add Windows-equivalent safe/destructive patterns

**File:** `packages/plan-mode/extensions/plan-mode/utils.ts`

**Add to `DESTRUCTIVE_PATTERNS` array** (after the existing entries, before the closing `]`):
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

**Add to `SAFE_PATTERNS` array** (after the existing entries, before the closing `]`):
```ts
  // Windows equivalents
  /^\s*dir\b/,
  /^\s*where\b/,
  /^\s*set\b/,
  /^\s*systeminfo\b/,
  /^\s*tasklist\b/,
```

### Step 5: browser-tools agent-browser-cli.ts — Add `shell: true` on Windows

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

Find the spawn call (~line 53):
```ts
const child = spawn(AGENT_BROWSER_BIN, finalArgs, {
  cwd: options.cwd,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

Change to:
```ts
const child = spawn(AGENT_BROWSER_BIN, finalArgs, {
  cwd: options.cwd,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});
```

### Step 6: browser-tools agent-browser-cli.ts — Make `shellEscape` platform-aware

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

Find:
```ts
function shellEscape(value: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/u.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}
```

Replace with:
```ts
function shellEscape(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/u.test(value)) return value;
  if (process.platform === 'win32') {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
```

### Step 7: browser-tools agent-browser-cli.ts — Update install guidance for cross-platform

**File:** `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

Find:
```ts
const AGENT_BROWSER_INSTALL_GUIDANCE = [
  'agent-browser backend selected, but the CLI is unavailable.',
  'Install with either:',
  '  brew install agent-browser && agent-browser install',
  'or',
  '  npm install -g agent-browser && agent-browser install',
].join('\n');
```

Replace with:
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

Also find the `createSpawnError` function's install hints:
```ts
'Install with one of:',
'  brew install agent-browser && agent-browser install',
'  npm install -g agent-browser && agent-browser install',
```

Replace with:
```ts
'Install with one of:',
...(process.platform === 'darwin'
  ? ['  brew install agent-browser && agent-browser install']
  : []),
'  npm install -g agent-browser && agent-browser install',
```

### Step 8: subagent spawn-utils.ts — Add `shell: true` on Windows for bare `pi` command

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

### Step 9: lsp config.ts — Prefer `homedir()` over `process.env.HOME`

**File:** `packages/lsp/extensions/lsp/config.ts`

Find (line ~24):
```ts
return join(process.env.HOME ?? homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```

Replace with:
```ts
return join(homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```

### Step 10: Add a unit test for the updated `readPlansJson`

Create a new file `packages/plan-mode/test/plans-json.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

describe('readPlansJson', () => {
  test('reads valid plans.json', async () => {
    const tmp = await mkdtemp(join(os.tmpdir(), 'plans-json-test-'));
    const plansDir = join(tmp, '.plans');
    await mkdir(plansDir, { recursive: true });
    const manifest = { 'test-plan': { status: 'in-progress', title: 'Test', created: new Date().toISOString(), completed: null } };
    await writeFile(join(plansDir, 'plans.json'), JSON.stringify(manifest), 'utf8');

    // We need to run readPlansJson from the tmp directory context
    const originalCwd = process.cwd();
    process.chdir(tmp);
    try {
      const { readPlansJson } = await import('../extensions/plan-mode/plans-json.ts');
      const result = await readPlansJson();
      expect(result['test-plan']?.status).toBe('in-progress');
    } finally {
      process.chdir(originalCwd);
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('returns empty object when file is missing', async () => {
    const tmp = await mkdtemp(join(os.tmpdir(), 'plans-json-test-'));
    const originalCwd = process.cwd();
    process.chdir(tmp);
    try {
      const { readPlansJson } = await import('../extensions/plan-mode/plans-json.ts');
      const result = await readPlansJson();
      expect(result).toEqual({});
    } finally {
      process.chdir(originalCwd);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
```

Note: The dynamic import with `chdir` may need adjustment depending on how `PLANS_JSON` resolves (it's a relative path `'.plans/plans.json'`). If the relative path doesn't resolve from `cwd`, you may need to use `path.resolve` in the implementation. Check and adjust.

### Step 11: Run tests and verify

Run `bun test` at the repo root. All existing tests in `test/pi-compat.test.ts` and `packages/lsp/test/` must pass. The plan-mode compat test should still work since it doesn't actually call `pi.exec('cat', ...)` — it only tests tool registration, active tools, and tool blocking.

Fix any failures before marking complete.
