---
name: "Stagehand LOCAL runtime + config foundation"
overview: "Introduce a local-only Stagehand runtime and a browser-tools config loader without switching the public tool surface yet. This slice creates the session lifecycle, settings model, and dependency base needed for the later browser_* migration."
todo:
  - id: "runtime-foundation-1"
    task: "Add browser-tools config types and a config-only loader for ~/.pi/agent/extensions/browser-tools/config.json"
    status: pending
  - id: "runtime-foundation-2"
    task: "Add a Stagehand LOCAL runtime module with serialized access, idle shutdown, viewport helpers, screenshots, and console capture"
    status: pending
  - id: "runtime-foundation-3"
    task: "Update the package manifest for Stagehand and keep mcp-server-browserbase as reference-only, not a runtime dependency"
    status: pending
---

# Goal

Create the Stagehand foundation for `@dreki-gg/pi-browser-tools` so later slices can replace the Playwright-shaped tool surface without guessing about config, session lifecycle, or runtime ownership.

# Context

- Parent feature: migrate `packages/browser-tools` from direct Playwright runtime usage to direct Stagehand SDK usage.
- Approved decisions from the current conversation:
  - Runtime target: **Stagehand `LOCAL`**
  - Tool naming: **mixed** (`web_search` stays, interactive/runtime tools move to `browser_*`)
  - Text-first reading: **rename to a read-oriented tool** instead of keeping `web_visit`
  - Secrets/config: **config file only**, no env fallback for browser-tools
- This slice must land **before** the tool-surface rewrite plan because the current package has no Stagehand runtime or config loader.
- This slice must **not** add `mcp-server-browserbase` as a dependency or runtime abstraction. That repo is reference material only.

## What exists

Module root: `packages/browser-tools`

Current file tree:

- `packages/browser-tools/package.json`
- `packages/browser-tools/tsconfig.json`
- `packages/browser-tools/README.md`
- `packages/browser-tools/CHANGELOG.md`
- `packages/browser-tools/extensions/browser-tools/core.ts`
- `packages/browser-tools/extensions/browser-tools/index.ts`
- `packages/browser-tools/extensions/browser-tools/markdown.ts`
- `packages/browser-tools/extensions/browser-tools/search.ts`

Actual current state on disk:

- `extensions/browser-tools/core.ts` directly imports `playwright` and owns the runtime session (`BrowserSession`) with these responsibilities:
  - serialize access via `runExclusive()` (`core.ts:79-86`)
  - idle shutdown via `resetIdleTimer()` (`core.ts:88-93`)
  - browser/page creation via `ensureBrowser()` (`core.ts:95-117`)
  - viewport changes via `setViewport()` (`core.ts:129-139`)
  - screenshots via `screenshotToBase64()` (`core.ts:141-145`)
  - console buffering via `attachConsoleListeners()` / `getConsoleEntries()` (`core.ts:148-201`)
- `extensions/browser-tools/index.ts` registers `web_search`, `web_visit`, `web_screenshot`, `web_interact`, `web_console`, and `/browser` (`index.ts:95-417`).
- `extensions/browser-tools/markdown.ts` mixes pure fetch/readability with a Playwright rendering fallback (`markdown.ts:58-136`).
- `extensions/browser-tools/search.ts` currently reads provider config from environment variables (`search.ts:18-23`, `search.ts:128-170`, `search.ts:205-220`).
- `package.json` has **no Stagehand dependency** and still depends on `playwright` (`package.json:37-42`).
- There is **no** config loader, config types module, docs directory, or test directory in this package.

Reference-only external code already available in the workspace:

- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/sessionManager.ts:12-71` creates Stagehand with `env: "BROWSERBASE"` and requires Browserbase keys.
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/navigate.ts:6-63`, `act.ts:6-54`, `observe.ts:6-54`, and `extract.ts:6-56` show the Stagehand-native tool primitives to mirror conceptually.

Why that MCP repo is not the runtime to reuse here:

- It hardcodes `env: "BROWSERBASE"` (`sessionManager.ts:30-44`).
- It throws when Browserbase keys are missing (`sessionManager.ts:17-22`).
- The approved feature explicitly wants direct Pi integration and **no MCP runtime layer**.

# API inventory

## Current browser-tools runtime API

From `packages/browser-tools/extensions/browser-tools/core.ts`:

```ts
export type ViewportPreset = 'desktop' | 'mobile';

export type ViewportOptions = {
  preset?: ViewportPreset;
  width?: number;
  height?: number;
};

export type ConsoleEntry = {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'page-error';
  text: string;
  url: string | null;
  timestamp: number;
};

export type BrowserStatus = {
  isOpen: boolean;
  url: string | null;
  viewport: { width: number; height: number } | null;
};

export class BrowserSession {
  get isOpen(): boolean;
  get currentUrl(): string | null;
  get currentViewport(): { width: number; height: number } | null;
  getStatus(): BrowserStatus;
  runExclusive<T>(operation: () => Promise<T>): Promise<T>;
  resetIdleTimer(): void;
  ensureBrowser(): Promise<Page>;
  getPage(viewport?: ViewportOptions): Promise<Page>;
  setViewport(
    preset?: ViewportPreset,
    width?: number,
    height?: number,
  ): Promise<{ width: number; height: number }>;
  screenshotToBase64(): Promise<string>;
  getConsoleEntries(options?: { level?: ConsoleEntry['level'][]; clear?: boolean }): ConsoleEntry[];
  clearConsoleEntries(): void;
  close(): Promise<void>;
}
```

This behavior is the compatibility target for the new runtime module even if the underlying implementation changes.

## Existing config-loader pattern to copy structurally

From `packages/context7/extensions/context7/config.ts:10-52`:

```ts
const extensionDir = join(getAgentDir(), 'extensions', 'context7');
const configPath = join(extensionDir, 'config.json');
const cacheDir = join(extensionDir, 'cache');

export async function loadSettings(): Promise<Context7Settings>
```

This is the path-discovery and JSON-loading pattern to follow. For browser-tools, the approved choice is **config file only**, so do **not** keep Context7's env-var fallback behavior.

## Stagehand APIs the later slices will consume

From Stagehand docs fetched through Context7:

```ts
interface V3Options {
  env: 'LOCAL' | 'BROWSERBASE';
  localBrowserLaunchOptions?: LocalBrowserLaunchOptions;
  model?: ModelConfiguration;
  llmClient?: LLMClient;
  systemPrompt?: string;
  selfHeal?: boolean;
  experimental?: boolean;
  domSettleTimeout?: number;
  cacheDir?: string;
  keepAlive?: boolean;
  serverCache?: boolean;
  verbose?: 0 | 1 | 2;
  logInferenceToFile?: boolean;
  disablePino?: boolean;
  logger?: (line: LogLine) => void;
}

const stagehand = new Stagehand({ env: 'LOCAL', ...options });
await stagehand.init();
await stagehand.close();
const page = stagehand.context.pages()[0];
await stagehand.act('click button');
const observations = await stagehand.observe('find all form input fields');
const extraction = await stagehand.extract({});
await page.screenshot();
await page.setViewportSize(1920, 1080);
page.on('console', (message) => { ... });
```

Use these as the Stagehand-facing API surface. Do not route them through MCP.

## Proposed config shape for this package

Create a typed config model up front so later slices do not invent fields ad hoc:

```ts
export interface BrowserToolsConfigFile {
  stagehand?: {
    modelName?: string;
    modelApiKey?: string;
    domSettleTimeout?: number;
    cacheDir?: string;
    verbose?: 0 | 1 | 2;
    selfHeal?: boolean;
    experimental?: boolean;
    localBrowserLaunchOptions?: {
      headless?: boolean;
      devtools?: boolean;
      executablePath?: string;
      port?: number;
      args?: string[];
      userDataDir?: string;
      viewport?: { width: number; height: number };
      proxy?: { server: string; username?: string; password?: string };
      ignoreHTTPSErrors?: boolean;
      downloadsPath?: string;
      acceptDownloads?: boolean;
      connectTimeoutMs?: number;
    };
  };
  search?: {
    provider?: 'duckduckgo' | 'google' | 'brave';
    googleCseApiKey?: string;
    googleCseId?: string;
    braveSearchApiKey?: string;
  };
  runtime?: {
    idleTimeoutMs?: number;
  };
}

export interface BrowserToolsSettings {
  extensionDir: string;
  configPath: string;
  configError?: string;
  stagehand: {
    modelName: string;
    modelApiKey?: string;
    domSettleTimeout?: number;
    cacheDir?: string;
    verbose?: 0 | 1 | 2;
    selfHeal?: boolean;
    experimental?: boolean;
    localBrowserLaunchOptions?: BrowserToolsConfigFile['stagehand']['localBrowserLaunchOptions'];
  };
  search: {
    provider: 'duckduckgo' | 'google' | 'brave';
    googleCseApiKey?: string;
    googleCseId?: string;
    braveSearchApiKey?: string;
  };
  runtime: {
    idleTimeoutMs: number;
  };
}
```

# Tasks

## 1. Add browser-tools config types and a config-only loader for `~/.pi/agent/extensions/browser-tools/config.json`

### Files
- Create `packages/browser-tools/extensions/browser-tools/config-types.ts`
- Create `packages/browser-tools/extensions/browser-tools/config.ts`

### What to add
- A `config-types.ts` module that defines `BrowserToolsConfigFile` and `BrowserToolsSettings`.
- A `config.ts` module that:
  - computes `extensionDir` as `join(getAgentDir(), 'extensions', 'browser-tools')`
  - computes `configPath` as `join(extensionDir, 'config.json')`
  - reads/parses JSON if the file exists
  - returns normalized defaults for non-secret fields
  - **does not** read from `process.env`
  - preserves `configError` if JSON parsing fails so tools can surface a helpful error
- Normalize these defaults in one place:
  - `stagehand.modelName`: default to `google/gemini-2.5-flash-lite`
  - `search.provider`: default to `duckduckgo`
  - `runtime.idleTimeoutMs`: default to `30_000`

### Notes
- Keep secrets in the config file only, per the approved choice.
- Do not read `~/.asset-bot/config.json` at runtime.
- The later tool slice will reuse the same settings object for both search and Stagehand.

## 2. Add a Stagehand LOCAL runtime module with serialized access, idle shutdown, viewport helpers, screenshots, and console capture

### Files
- Create `packages/browser-tools/extensions/browser-tools/stagehand-runtime.ts`

### What to add
Implement a runtime module that mirrors the important semantics of the existing `BrowserSession`, but on top of Stagehand LOCAL mode.

Required responsibilities:

- Own exactly one lazily-created Stagehand session.
- Serialize browser operations with the same queue pattern now used in `core.ts:79-86`.
- Auto-close after an idle timeout.
- Attach console listeners to the active page and keep the current `ConsoleEntry` buffer behavior.
- Expose helpers that later tools can call directly.

Recommended shape:

```ts
export class StagehandRuntime {
  get isOpen(): boolean;
  get currentUrl(): string | null;
  get currentViewport(): { width: number; height: number } | null;
  getStatus(): BrowserStatus;
  runExclusive<T>(operation: () => Promise<T>): Promise<T>;
  resetIdleTimer(): void;
  ensureSession(): Promise<{ stagehand: Stagehand; page: any }>;
  getPage(viewport?: ViewportOptions): Promise<any>;
  setViewport(
    preset?: ViewportPreset,
    width?: number,
    height?: number,
  ): Promise<{ width: number; height: number }>;
  screenshotToBase64(options?: { fullPage?: boolean }): Promise<string>;
  getConsoleEntries(options?: { level?: ConsoleEntry['level'][]; clear?: boolean }): ConsoleEntry[];
  clearConsoleEntries(): void;
  close(): Promise<void>;
}
```

Implementation rules:

- Construct Stagehand with `env: 'LOCAL'`.
- Pass `model` from the config file when `modelApiKey` exists.
- Pass `localBrowserLaunchOptions`, `domSettleTimeout`, `cacheDir`, `verbose`, `selfHeal`, and `experimental` from config when present.
- Use `stagehand.context.pages()[0]` as the active page.
- Preserve the current viewport preset behavior (`desktop` / `mobile`) from `core.ts:24-45`.
- Preserve the current `ConsoleEntry` level mapping from `core.ts:148-178`.

### Notes
- This slice introduces the runtime **alongside** the existing Playwright-backed code; do not rewrite `index.ts` yet.
- Avoid importing anything from the MCP server repo. Only mirror behavior.

## 3. Update the package manifest for Stagehand and keep `mcp-server-browserbase` as reference-only, not a runtime dependency

### Files
- Modify `packages/browser-tools/package.json`
- Modify `packages/browser-tools/tsconfig.json` only if the new runtime needs compiler settings beyond the current package defaults

### What to change
- Add `@browserbasehq/stagehand` to `dependencies`.
- Keep `playwright` temporarily in this slice if the existing tool surface still imports it indirectly; removal belongs to the later cleanup/docs slice after the tool migration lands.
- Do **not** add `@browserbasehq/mcp`, `@modelcontextprotocol/sdk`, or a workspace dependency on `/Users/jalbarran/fun/drekki/mcp-server-browserbase`.
- If Stagehand types require it, keep using the package’s current TS module settings (`tsconfig.json:2-16`) rather than inventing a package-specific build step.

# Files to create

- `packages/browser-tools/extensions/browser-tools/config-types.ts`
- `packages/browser-tools/extensions/browser-tools/config.ts`
- `packages/browser-tools/extensions/browser-tools/stagehand-runtime.ts`

# Files to modify

- `packages/browser-tools/package.json` — add Stagehand dependency, keep runtime package metadata coherent
- `packages/browser-tools/tsconfig.json` — only if needed for Stagehand type resolution

# Testing notes

- Run `bun run --filter '@dreki-gg/pi-browser-tools' typecheck` after adding the new modules.
- Do not remove `playwright` in this slice unless the package still typechecks without it.
- The runtime module should be typecheck-safe even before any tool starts importing it.
- No smoke test is required yet; that comes in the later validation slice.

# Patterns to follow

- `packages/context7/extensions/context7/config.ts:10-52` — path discovery, JSON loading, normalization, `configError` propagation
- `packages/browser-tools/extensions/browser-tools/core.ts:24-45` — viewport preset normalization
- `packages/browser-tools/extensions/browser-tools/core.ts:79-145` — serialized runtime operations, idle timeout, screenshot helper structure
- `packages/browser-tools/extensions/browser-tools/core.ts:148-201` — console buffering and filtering
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/navigate.ts:18-55` — thin Stagehand-native wrapper pattern
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/act.ts:18-46` — direct `stagehand.act(...)` usage
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/observe.ts:18-46` — direct `stagehand.observe(...)` usage
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/extract.ts:18-48` — direct `stagehand.extract(...)` usage
