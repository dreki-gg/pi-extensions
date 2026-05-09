# Windows Compatibility Refactor — Execution Prompt

You are implementing Windows compatibility fixes across 4 extension packages in a pi-extensions monorepo. Pi runs on **Bun**, so use Bun-native APIs (`Bun.file()`, `Bun.write()`) for new file I/O code.

## Repo Structure

```
packages/
  browser-tools/
    extensions/browser-tools/backends/agent-browser-cli.ts  ← spawn + shell escape fixes
    package.json
    tsconfig.json
  lsp/
    extensions/lsp/config.ts          ← homedir() fix
  plan-mode/
    extensions/plan-mode/index.ts     ← replace all pi.exec('cat'/'bash'/'mkdir') with Bun APIs
    extensions/plan-mode/plans-json.ts ← replace exec callback with Bun.file()
    extensions/plan-mode/utils.ts     ← add Windows safe/destructive patterns
    package.json                      ← add bun-types
    tsconfig.json                     ← add bun-types
  subagent/
    extensions/subagent/spawn-utils.ts ← shell: true on Windows for 'pi' command
test/pi-compat.test.ts                ← integration tests (verify passes after changes)
```

## Critical Constraints

- Use the `edit` tool for all changes to existing files (not `write`).
- Preserve all existing Unix/macOS behavior. Windows fixes must be additive.
- Use **`Bun.file(path).text()`** instead of `readFile(path, 'utf8')` and **`Bun.write(path, content)`** instead of `writeFile(path, content)` for new file I/O in plan-mode.
- Keep `mkdir` from `node:fs/promises` — Bun has no equivalent for recursive directory creation.
- `Bun.file(path).text()` throws on missing files. Use `Bun.file(path).exists()` to guard, or wrap in try/catch.
- `Bun.write()` does NOT auto-create parent directories — always `mkdir` first.
- The `bin/clean-plans.js` file is plain JS that runs via `npx` — leave it using `node:fs`.
- Run `bun install` after package.json changes, then `bun test` to verify.
- Mark each step done with `[DONE:n]` after completing it.

---

## Steps

### Step 1: Add `bun-types` to plan-mode package

**File: `packages/plan-mode/package.json`**

Add `"bun-types": "latest"` to the `devDependencies` object (alongside the existing entries):

```json
"devDependencies": {
  "@types/node": "24",
  "bun-types": "latest",
  "oxfmt": "^0.43.0",
  ...
}
```

**File: `packages/plan-mode/tsconfig.json`**

Add `"types": ["bun-types"]` to `compilerOptions`:

```json
"compilerOptions": {
  "target": "ES2022",
  ...
  "types": ["bun-types"],
  "rootDir": "."
}
```

Run `bun install` from the repo root.

### Step 2: plan-mode index.ts — Replace `pi.exec('cat', ...)` reads with `Bun.file().text()`

**File: `packages/plan-mode/extensions/plan-mode/index.ts`**

Add this import at the top, after the existing imports:
```ts
import { mkdir } from 'node:fs/promises';
```

There are 4 places that use `pi.exec('cat', [path])`. Replace each one:

**Site 1 (~line 422)** — reading PLAN.md to extract title on first write:
```ts
// FIND:
        try {
          const result = await pi.exec('cat', [path]);
          if (result.code === 0) {
            title = extractPlanTitle(result.stdout);
          }
        } catch {

// REPLACE WITH:
        try {
          const content = await Bun.file(path).text();
          title = extractPlanTitle(content);
        } catch {
```

**Site 2 (~line 435)** — reading PLAN.md for title update:
```ts
// FIND:
      try {
        const result = await pi.exec('cat', [path]);
        if (result.code === 0) {
          const title = extractPlanTitle(result.stdout);
          await updatePlansManifest(match[1], 'in-progress', title);
        }
      } catch {

// REPLACE WITH:
      try {
        const content = await Bun.file(path).text();
        const title = extractPlanTitle(content);
        await updatePlansManifest(match[1], 'in-progress', title);
      } catch {
```

**Site 3 (~line 503)** — reading planMdPath for todo extraction:
```ts
// FIND:
        const result = await pi.exec('cat', [planMdPath]);
        if (result.code === 0) {
          planContent = result.stdout;
        }

// REPLACE WITH:
        planContent = await Bun.file(planMdPath).text();
```
(Keep the surrounding try/catch.)

**Site 4 (~line 519)** — reading startPromptPath:
```ts
// FIND:
        const result = await pi.exec('cat', [startPromptPath]);
        if (result.code === 0) {
          startPrompt = result.stdout.trim();
        }

// REPLACE WITH:
        startPrompt = (await Bun.file(startPromptPath).text()).trim();
```
(Keep the surrounding try/catch.)

### Step 3: plan-mode index.ts — Replace `mkdir` + `bash` write with `mkdir` + `Bun.write()`

**File: `packages/plan-mode/extensions/plan-mode/index.ts`**

Find in `updatePlansManifest` (~lines 125-128):
```ts
    await pi.exec('mkdir', ['-p', '.plans']);
    const content = serializePlansJson(manifest);
    // Write via a temp approach — use bash echo to avoid needing the write tool
    await pi.exec('bash', ['-c', `cat > .plans/plans.json << 'PLANS_EOF'\n${content}PLANS_EOF`]);
```

Replace with:
```ts
    await mkdir('.plans', { recursive: true });
    const content = serializePlansJson(manifest);
    await Bun.write('.plans/plans.json', content);
```

### Step 4: plan-mode index.ts — Update `readPlansJson` call site

**File: `packages/plan-mode/extensions/plan-mode/index.ts`** (~line 114)

Find:
```ts
    const manifest = await readPlansJson((cmd, args) => pi.exec(cmd, args));
```

Replace with:
```ts
    const manifest = await readPlansJson();
```

### Step 5: plan-mode plans-json.ts — Replace `exec` callback with `Bun.file()`

**File: `packages/plan-mode/extensions/plan-mode/plans-json.ts`**

The current `readPlansJson` function:
```ts
/** Read plans.json via pi.exec, returning current manifest (empty object if missing). */
export async function readPlansJson(exec: (cmd: string, args: string[]) => Promise<{ code: number; stdout: string }>): Promise<PlansManifest> {
  try {
    const result = await exec('cat', [PLANS_JSON]);
    if (result.code === 0 && result.stdout.trim()) {
      return JSON.parse(result.stdout) as PlansManifest;
    }
  } catch {
    // File doesn't exist or isn't valid JSON
  }
  return {};
}
```

Replace with:
```ts
/** Read plans.json, returning current manifest (empty object if missing). */
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

### Step 6: plan-mode utils.ts — Add Windows safe/destructive patterns

**File: `packages/plan-mode/extensions/plan-mode/utils.ts`**

**In `DESTRUCTIVE_PATTERNS`**, add these entries after the last existing pattern (before the closing `];`):
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

**In `SAFE_PATTERNS`**, add these entries after the last existing pattern (before the closing `];`):
```ts
  // Windows equivalents
  /^\s*dir\b/,
  /^\s*where\b/,
  /^\s*set\b/,
  /^\s*systeminfo\b/,
  /^\s*tasklist\b/,
```

### Step 7: browser-tools — Add `shell: true` on Windows for `spawn`

**File: `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`**

Find the spawn call (~line 53):
```ts
    const child = spawn(AGENT_BROWSER_BIN, finalArgs, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
```

Replace with:
```ts
    const child = spawn(AGENT_BROWSER_BIN, finalArgs, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
```

### Step 8: browser-tools — Make `shellEscape` platform-aware

**File: `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`**

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

### Step 9: browser-tools — Update install guidance for cross-platform

**File: `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`**

Find the `AGENT_BROWSER_INSTALL_GUIDANCE` constant:
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

Also find the install hints in `createSpawnError` function:
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

### Step 10: subagent — Add `shell: true` on Windows for bare `pi` command

**File: `packages/subagent/extensions/subagent/spawn-utils.ts`**

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

### Step 11: lsp — Prefer `homedir()` over `process.env.HOME`

**File: `packages/lsp/extensions/lsp/config.ts`** (~line 24)

Find:
```ts
  return join(process.env.HOME ?? homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```

Replace with:
```ts
  return join(homedir(), '.pi', 'agent', 'extensions', 'lsp', 'config.json');
```

### Step 12: Run tests and verify

1. Run `bun install` from the repo root (needed after step 1's package.json change).
2. Run `bun test` from the repo root.
3. All tests in `test/pi-compat.test.ts` and `packages/lsp/test/` must pass.
4. The plan-mode compat test should still pass — it tests tool registration, active tools, and tool blocking, not file I/O.
5. Fix any failures before marking complete.
