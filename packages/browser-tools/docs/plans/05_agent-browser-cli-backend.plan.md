---
name: "Agent-browser CLI backend"
overview: "Add an internal BrowserBackend implementation that drives a local agent-browser CLI session. This slice should satisfy the new backend interface from slice 04 without changing the public tool layer yet."
todo:
  - id: "agent-browser-backend-1"
    task: "Add a small agent-browser command runner and stable session-id helpers for browser-tools"
    status: pending
  - id: "agent-browser-backend-2"
    task: "Implement a BrowserBackend-compatible agent-browser backend for navigation, screenshots, rendered-page extraction, interactions, and close/status behavior"
    status: pending
  - id: "agent-browser-backend-3"
    task: "Implement console normalization and best-effort text targeting on top of agent-browser snapshot/console/errors commands"
    status: pending
---

# Goal

Implement an `agent-browser` backend behind the internal browser interface so `@dreki-gg/pi-browser-tools` can later switch between Playwright and `agent-browser` without changing the public tool contracts.

# Context

- Parent feature: add `agent-browser` as an alternative browser backend for `@dreki-gg/pi-browser-tools`.
- This slice depends on `04_browser-backend-interface-and-playwright-adapter.plan.md` landing first.
- Approved direction from the conversation:
  - keep the package name the same for now
  - use backend abstraction first
  - local CLI dependency is acceptable for experimentation
  - compatibility should be “mostly compatible”, not a full API redesign
- This slice should add the backend implementation only. Do not wire it into public tool selection here.

## What exists

Actual codebase state today:

- `packages/browser-tools` has no `backends/` directory yet unless slice 04 has landed.
- There is no `child_process` or shell-based browser runtime in this package today.
- The current browser runtime is entirely Playwright-based in `extensions/browser-tools/core.ts`.
- `index.ts` assumes in-process APIs such as:
  - locator-based click/fill/select/hover
  - direct screenshot bytes from the page object
  - in-memory console buffering from Playwright events
  - in-process `page.evaluate(...)` for rendered-page extraction
- The package currently has no notion of CLI session IDs, temp screenshot files, or JSON parsing from subprocess output.

Relevant external `agent-browser` facts already gathered in this session:

- `agent-browser` supports stable sessions via `--session <name>`.
- Common commands include:

```bash
agent-browser open <url> --session <name>
agent-browser wait --load networkidle --session <name>
agent-browser snapshot -i --json --session <name>
agent-browser click <selector-or-ref> --session <name>
agent-browser fill <selector-or-ref> "value" --session <name>
agent-browser hover <selector-or-ref> --session <name>
agent-browser select <selector-or-ref> "value" --session <name>
agent-browser scroll down 300 --session <name>
agent-browser console --json --session <name>
agent-browser console --json --clear --session <name>
agent-browser errors --json --session <name>
agent-browser eval "document.documentElement.outerHTML" --session <name>
agent-browser set viewport 1280 800 --session <name>
agent-browser screenshot ./tmp.png --session <name>
agent-browser close --session <name>
```

- `snapshot -i --json` returns accessibility refs for interactive elements.
- Refs are invalidated by navigation or major page changes.
- `console` and `errors` are separate commands; they must be merged if the package wants one `web_console` view.
- Install flows from docs:

```bash
brew install agent-browser
agent-browser install
```

or

```bash
npm install -g agent-browser
agent-browser install
```

# API inventory

## Backend contract this slice must satisfy

From slice 04, the new backend needs to implement:

```ts
export interface BrowserBackend {
  readonly name: 'playwright' | 'agent-browser';
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
  }): Promise<{ imageBase64: string; url: string | null; viewport: { width: number; height: number } | null }>;
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

## Internal helper APIs to add in this slice

The `agent-browser` backend will need small process helpers. Keep them internal but explicit.

```ts
type AgentBrowserCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

async function runAgentBrowser(
  args: string[],
  options?: { expectJson?: boolean; cwd?: string },
): Promise<AgentBrowserCommandResult>;

function getBrowserToolsSessionId(): string;

function viewportFor(
  preset?: ViewportPreset,
  width?: number,
  height?: number,
): { width: number; height: number };
```

## Best-effort text targeting contract for this slice

Do not redesign the public tool surface yet. For `agent-browser`, preserve the existing `web_interact` inputs by resolving them internally.

```ts
selector?: string;
text?: string;
```

Resolution rules for this slice:

1. If `selector` is present, use it directly.
2. If only `text` is present:
   - call `agent-browser snapshot -i --json`
   - search the snapshot for the best exact name/text match
   - if a ref is found, use that ref for click/hover/fill/select
   - if no reliable match is found, throw a clear error that suggests using `selector`
3. Do not add a public `ref` parameter in this slice.

# Tasks

## 1. Add a small agent-browser command runner and stable session-id helpers for browser-tools

### Files
- Create `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`

### What to add
- A tiny subprocess wrapper around the `agent-browser` executable.
- Use Node built-ins only (`node:child_process`, `node:fs/promises`, `node:path`, `node:os`). Do not add extra npm dependencies just to run the CLI.
- Generate one stable session name for the package runtime, for example:

```ts
const sessionId = `pi-browser-tools-${process.pid}`;
```

- Every CLI call must include `--session <sessionId>` so successive tool calls share one browser session.
- Normalize command failures into informative JS errors that include:
  - attempted command
  - exit code
  - stderr/stdout excerpt
- Add an availability check helper that can fail fast later when backend selection is wired.

## 2. Implement a BrowserBackend-compatible agent-browser backend for navigation, screenshots, rendered-page extraction, interactions, and close/status behavior

### Files
- Create `packages/browser-tools/extensions/browser-tools/backends/agent-browser.ts`

### What to add
- Implement `BrowserBackend` using the CLI runner from task 1.
- Maintain package-level runtime state that mirrors the current `BrowserStatus` shape:
  - `isOpen`
  - `currentUrl`
  - `currentViewport`
- Keep serialized access inside the backend so concurrent tool calls do not fight over one session.
- Map backend methods to CLI commands:

| Backend method | CLI behavior |
|---|---|
| `navigate(url, options)` | `open`, optional `set viewport`, optional `wait` |
| `setViewport(...)` | `set viewport <w> <h>` |
| `screenshot(...)` | optional `open`, optional `set viewport`, then `screenshot <tempfile>` |
| `renderPage(url)` | `open`, optional `wait`, then `eval` to read full rendered HTML/title/url |
| `close()` | `close --session <id>` |

### Rendered-page extraction rule
- For `renderPage(url)`, use `agent-browser eval` to return JSON with:
  - `document.documentElement.outerHTML`
  - `document.title`
  - `window.location.href`
- Feed that into the existing markdown conversion helper from slice 04; do not duplicate readability logic inside the backend.

### Screenshot implementation rule
- Write screenshots to a temp file, then read the PNG bytes and base64-encode them.
- Clean up temp files even on failure.

## 3. Implement console normalization and best-effort text targeting on top of agent-browser snapshot/console/errors commands

### Files
- Modify `packages/browser-tools/extensions/browser-tools/backends/agent-browser.ts`
- Modify `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts` if helper parsing is needed

### What to add
- `getConsoleEntries()` should merge:
  - `agent-browser console --json`
  - `agent-browser errors --json`
- Normalize both into the package’s existing `ConsoleEntry` shape:

```ts
{
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'page-error';
  text: string;
  url: string | null;
  timestamp: number;
}
```

- If CLI JSON does not contain timestamps, synthesize them at read time with `Date.now()`.
- Support the package’s `clear` behavior by passing `--clear` to both commands when requested.
- Implement best-effort `text` targeting using `snapshot -i --json`:
  - exact accessible-name match first
  - then exact visible text
  - if multiple matches remain, fail with a disambiguation error instead of guessing
  - prefer `selector` over `text` whenever both are supplied

### Interaction mapping
- `click` → `agent-browser click <selector-or-ref>`
- `hover` → `agent-browser hover <selector-or-ref>`
- `type` → `agent-browser fill <selector-or-ref> "value"`
- `select` → `agent-browser select <selector-or-ref> "value"`
- `scroll` → `agent-browser scroll up|down <amount>`
- `wait` → `agent-browser wait <ms>` or the CLI equivalent already documented in the package docs

# Files to create

- `packages/browser-tools/extensions/browser-tools/backends/agent-browser-cli.ts`
- `packages/browser-tools/extensions/browser-tools/backends/agent-browser.ts`

# Files to modify

- None outside the new backend modules in this slice

# Testing notes

- This slice can typecheck without being active yet, but it should still compile cleanly.
- Minimum validation after implementation:

```bash
bun run --filter '@dreki-gg/pi-browser-tools' typecheck
bun run --filter '@dreki-gg/pi-browser-tools' lint
```

- Manual spot checks from the command line before wiring selection:
  - verify the CLI is installed and initialized
  - open a page with a temp session id
  - take a screenshot to a temp file
  - verify `console --json` and `errors --json` shapes on a page with known logs/errors

# Patterns to follow

- `packages/browser-tools/extensions/browser-tools/core.ts` — current serialized runtime ownership and status bookkeeping to mirror conceptually
- `packages/browser-tools/extensions/browser-tools/index.ts` — current action names and console detail shape that this backend must eventually support
- Agent Browser docs gathered in this session — command syntax, session usage, snapshot refs, `console`, `errors`, `screenshot`, `set viewport`, and `eval`
