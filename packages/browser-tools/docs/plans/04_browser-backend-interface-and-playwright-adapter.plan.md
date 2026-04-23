---
name: "Browser backend interface + Playwright adapter"
overview: "Introduce a backend abstraction inside @dreki-gg/pi-browser-tools, then move the existing Playwright runtime behind it without changing the public tool surface yet. This slice creates the seam that later lets the package add an agent-browser backend and backend selection safely."
todo:
  - id: "backend-interface-1"
    task: "Add shared browser backend types and a backend-facing render contract that does not leak Playwright Page objects"
    status: pending
  - id: "backend-interface-2"
    task: "Move the current Playwright BrowserSession implementation into a Playwright backend module that satisfies the shared interface"
    status: pending
  - id: "backend-interface-3"
    task: "Rewire index.ts and markdown.ts to use the new backend abstraction while preserving the current tool names, arguments, and behavior"
    status: pending
---

# Goal

Create an internal browser backend interface for `packages/browser-tools` and migrate the current Playwright runtime behind it so later slices can add `agent-browser` without rewriting the tool layer twice.

# Context

- Parent feature: add `agent-browser` as an alternative browser backend for `@dreki-gg/pi-browser-tools`.
- Approved direction from the current conversation:
  - keep `@dreki-gg/pi-browser-tools` as the package
  - abstract the backend before adding `agent-browser`
  - preserve the current tool surface where it is cheap
  - treat a locally installed `agent-browser` CLI as acceptable for the experiment
  - keep Playwright as the baseline until parity work is done
- This slice must land before any backend-selection or `agent-browser` wiring.
- This slice should keep behavior stable. Do not change tool names, command names, or public arguments here.

## What exists

Module root: `packages/browser-tools`

Actual file tree today:

- `packages/browser-tools/package.json`
- `packages/browser-tools/tsconfig.json`
- `packages/browser-tools/README.md`
- `packages/browser-tools/CHANGELOG.md`
- `packages/browser-tools/extensions/browser-tools/index.ts`
- `packages/browser-tools/extensions/browser-tools/core.ts`
- `packages/browser-tools/extensions/browser-tools/markdown.ts`
- `packages/browser-tools/extensions/browser-tools/search.ts`
- `packages/browser-tools/docs/plans/01_stagehand-local-runtime-and-config.plan.md`
- `packages/browser-tools/docs/plans/02_stagehand-tool-surface-and-reading-split.plan.md`
- `packages/browser-tools/docs/plans/03_package-docs-and-local-smoke-matrix.plan.md`

Current code state on disk:

- `extensions/browser-tools/core.ts` directly imports `playwright` and owns all browser state.
- `extensions/browser-tools/index.ts` imports `browserSession` from `./core.js` and registers:
  - `web_search`
  - `web_visit`
  - `web_screenshot`
  - `web_interact`
  - `web_console`
  - `/browser`
- `extensions/browser-tools/markdown.ts` exports:
  - `fetchAsMarkdown()`
  - `renderWithPlaywright(browserSession, url)`
- `extensions/browser-tools/search.ts` is already independent of the browser runtime.
- `package.json` still depends on `playwright` and has no concept of multiple backends.
- There is no backend interface file, no backend factory, and no `backends/` directory in the package.

Important coupling to remove in this slice:

- `index.ts` currently knows the concrete `browserSession` singleton.
- `markdown.ts` currently depends on the concrete `BrowserSession` type from `core.ts`.
- The current runtime abstraction leaks Playwright types (`Page`, `Browser`, `BrowserContext`) into the package internals.

# API inventory

## Current runtime API exported from `extensions/browser-tools/core.ts`

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

export const browserSession = new BrowserSession();
```

## Current markdown helpers from `extensions/browser-tools/markdown.ts`

```ts
export async function fetchAsMarkdown(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<{ markdown: string; title: string; method: 'fetch'; url: string }>;

export async function renderWithPlaywright(
  browserSession: BrowserSession,
  url: string,
): Promise<{ markdown: string; title: string; method: 'playwright'; url: string }>;
```

## Current public tool contracts from `extensions/browser-tools/index.ts`

```ts
web_visit {
  url: string;
  render?: boolean;
}

web_screenshot {
  url?: string;
  viewport?: 'desktop' | 'mobile';
  width?: number;
  height?: number;
}

web_interact {
  action: 'click' | 'type' | 'scroll' | 'select' | 'hover' | 'wait';
  selector?: string;
  text?: string;
  value?: string;
  direction?: 'up' | 'down';
  amount?: number;
  timeout?: number;
}

web_console {
  level?: Array<'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'page-error'>;
  clear?: boolean;
}
```

## Target internal backend contract for this slice

Create a shared internal interface that hides concrete browser engines from `index.ts` and `markdown.ts`.

```ts
export type BrowserBackendName = 'playwright' | 'agent-browser';

export type RenderedPage = {
  html: string;
  title: string;
  url: string;
  backend: BrowserBackendName;
};

export type BrowserInteractParams = {
  action: 'click' | 'type' | 'scroll' | 'select' | 'hover' | 'wait';
  selector?: string;
  text?: string;
  value?: string;
  direction?: 'up' | 'down';
  amount?: number;
  timeout?: number;
};

export type BrowserScreenshotResult = {
  imageBase64: string;
  url: string | null;
  viewport: { width: number; height: number } | null;
};

export interface BrowserBackend {
  readonly name: BrowserBackendName;
  isOpen(): boolean;
  getStatus(): BrowserStatus;
  navigate(
    url: string,
    options?: { preset?: ViewportPreset; width?: number; height?: number; waitMs?: number },
  ): Promise<{ url: string; viewport: { width: number; height: number } | null }>;
  setViewport(
    preset?: ViewportPreset,
    width?: number,
    height?: number,
  ): Promise<{ width: number; height: number }>;
  screenshot(options?: {
    url?: string;
    preset?: ViewportPreset;
    width?: number;
    height?: number;
    waitMs?: number;
  }): Promise<BrowserScreenshotResult>;
  interact(params: BrowserInteractParams): Promise<{
    url: string | null;
    viewport: { width: number; height: number } | null;
  }>;
  getConsoleEntries(options?: {
    level?: ConsoleEntry['level'][];
    clear?: boolean;
  }): Promise<ConsoleEntry[]>;
  renderPage(url: string): Promise<RenderedPage>;
  close(): Promise<void>;
}
```

Design rules for this contract:

- `index.ts` must not receive or import Playwright `Page` objects.
- `runExclusive()` should stay backend-internal; do not make the tool layer coordinate locks.
- `renderPage()` returns HTML/title/url data, not a browser object.
- Keep `BrowserStatus`, `ConsoleEntry`, `ViewportPreset`, and `ViewportOptions` as shared package types because the public tool layer already depends on those shapes.

# Tasks

## 1. Add shared browser backend types and a backend-facing render contract that does not leak Playwright Page objects

### Files
- Create `packages/browser-tools/extensions/browser-tools/backends/types.ts`
- Modify `packages/browser-tools/extensions/browser-tools/markdown.ts`

### What to add
- Move shared runtime-facing types into `backends/types.ts`:
  - `ViewportPreset`
  - `ViewportOptions`
  - `ConsoleEntry`
  - `BrowserStatus`
  - `BrowserBackendName`
  - `RenderedPage`
  - `BrowserInteractParams`
  - `BrowserScreenshotResult`
  - `BrowserBackend`
- Update `markdown.ts` so it no longer depends on `BrowserSession`.
- Keep `fetchAsMarkdown()` as-is.
- Replace `renderWithPlaywright()` with a backend-agnostic helper that accepts rendered HTML data, for example:

```ts
export function renderedPageToMarkdown(
  page: RenderedPage,
): { markdown: string; title: string; method: BrowserBackendName; url: string };
```

This keeps the readability/turndown logic reusable by both Playwright and `agent-browser`.

## 2. Move the current Playwright BrowserSession implementation into a Playwright backend module that satisfies the shared interface

### Files
- Create `packages/browser-tools/extensions/browser-tools/backends/playwright.ts`
- Delete `packages/browser-tools/extensions/browser-tools/core.ts` after imports have moved

### What to add
- Port the current `BrowserSession` behavior into a backend class or singleton in `backends/playwright.ts`.
- Preserve the current semantics:
  - serialized operations
  - one browser/page session per package runtime
  - 30 second idle shutdown
  - desktop/mobile viewport presets
  - console buffering with the same normalized levels
  - screenshot output as base64 PNG
- Implement `renderPage(url)` by moving the current rendered-page logic out of `renderWithPlaywright()`:
  - navigate with `domcontentloaded`
  - wait ~1500ms
  - evaluate the page to collect HTML/title/final URL
  - return a `RenderedPage`
- Keep the existing locator behavior for Playwright interactions:
  - `selector` first
  - then exact text
  - then fuzzy text
  - then role/name fallbacks

### Code sketch

```ts
class PlaywrightBackend implements BrowserBackend {
  readonly name = 'playwright' as const;
  // move current browser/context/page/queue/idleTimer/consoleEntries fields here
}

export const playwrightBackend = new PlaywrightBackend();
```

## 3. Rewire `index.ts` and `markdown.ts` to use the new backend abstraction while preserving the current tool names, arguments, and behavior

### Files
- Modify `packages/browser-tools/extensions/browser-tools/index.ts`
- Modify `packages/browser-tools/extensions/browser-tools/markdown.ts`

### What to change
- Replace imports from `./core.js` with imports from `./backends/playwright.js` and `./backends/types.js`.
- Keep the public tool registrations unchanged in this slice.
- Update `web_visit` so:
  - fetch path still calls `fetchAsMarkdown()`
  - render path uses `playwrightBackend.renderPage(url)` + `renderedPageToMarkdown(...)`
  - fallback-to-render still behaves the same when fetch output is too thin
- Update `web_screenshot`, `web_interact`, `web_console`, `/browser`, and `session_shutdown` to call the backend methods rather than concrete `browserSession` methods.
- Do not add backend selection yet. This slice should still use Playwright only.

# Files to create

- `packages/browser-tools/extensions/browser-tools/backends/types.ts`
- `packages/browser-tools/extensions/browser-tools/backends/playwright.ts`

# Files to modify

- `packages/browser-tools/extensions/browser-tools/index.ts` — switch tool-layer runtime calls to the backend API
- `packages/browser-tools/extensions/browser-tools/markdown.ts` — remove concrete `BrowserSession` dependency and add backend-agnostic rendered-page conversion

# Files to remove

- `packages/browser-tools/extensions/browser-tools/core.ts` — after all imports have moved to `backends/playwright.ts`

# Testing notes

- This slice should be behavior-preserving. Validate with the current package-level commands before touching `agent-browser`.
- Minimum validation after implementation:

```bash
bun run --filter '@dreki-gg/pi-browser-tools' typecheck
bun run --filter '@dreki-gg/pi-browser-tools' lint
```

- Manual smoke after the refactor should still work exactly as today:
  - `web_visit` with and without `render: true`
  - `web_screenshot`
  - `web_interact` for click/type/select/scroll/wait
  - `web_console`
  - `/browser`

# Patterns to follow

- `packages/browser-tools/extensions/browser-tools/core.ts` — existing session ownership, console buffering, and idle timeout behavior to preserve
- `packages/browser-tools/extensions/browser-tools/index.ts` — existing tool result shapes that should stay stable in this slice
- `packages/browser-tools/extensions/browser-tools/markdown.ts` — existing readability/turndown pipeline that should stay reusable
