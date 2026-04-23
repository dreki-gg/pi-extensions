---
name: "Stagehand tool surface + read-flow split"
overview: "Replace the Playwright-shaped browser tool API with a Stagehand-native mixed-prefix tool set while keeping text-first reading separate. This slice keeps `web_search`, renames the read tool, and moves interactive browser work to `browser_*` tools backed by the Stagehand runtime."
todo:
  - id: "tool-surface-1"
    task: "Rewrite index.ts to register the mixed-prefix Stagehand tool set and update /browser to use the new runtime"
    status: pending
  - id: "tool-surface-2"
    task: "Simplify markdown.ts into a fetch/readability-only read helper and remove Playwright render fallback behavior"
    status: pending
  - id: "tool-surface-3"
    task: "Move search configuration off environment variables, delete Playwright-only interaction helpers, and finish the runtime import switch"
    status: pending
---

# Goal

Ship the new public tool surface for browser-tools: keep `web_search`, rename text-first reading to a read-oriented tool, and expose Stagehand-native `browser_*` primitives for navigation, observation, actions, extraction, screenshots, and console output.

# Context

- Parent feature: migrate `packages/browser-tools` to direct Stagehand SDK usage.
- This plan depends on `01_stagehand-local-runtime-and-config.plan.md` landing first.
- Approved decisions to honor:
  - **Mixed naming**: keep `web_search`, use `browser_*` for interactive/runtime tools
  - **Text-first reading stays separate**: rename the old `web_visit` flow into a dedicated read tool
  - **Config-only settings**: stop relying on env vars inside browser-tools
  - **Stagehand LOCAL mode** only

## What exists

Actual current tool surface in `packages/browser-tools/extensions/browser-tools/index.ts`:

- `web_search` (`index.ts:96-126`) — works independently of the browser runtime
- `web_visit` (`index.ts:128-165`) — mixes pure fetch with a Playwright render fallback from `markdown.ts`
- `web_screenshot` (`index.ts:167-216`) — takes screenshots using the Playwright-backed `BrowserSession`
- `web_interact` (`index.ts:218-317`) — exposes selector/text/value actions that depend on Playwright APIs like `locator()`, `getByText()`, `getByRole()`, `fill()`, and `selectOption()`
- `web_console` (`index.ts:319-392`) — reads the runtime console buffer
- `/browser` (`index.ts:394-416`) — reports runtime status

Playwright-specific coupling that must be removed in this slice:

- `resolveLocator()` in `index.ts:66-93` depends on Playwright selector ergonomics and role/text queries.
- `ACTION_ENUM` and `SCROLL_DIRECTION_ENUM` in `index.ts:21-22` encode a deterministic selector-based action model, not Stagehand’s natural-language primitive model.
- `renderWithPlaywright()` in `markdown.ts:88-136` explicitly requires a browser runtime for read fallback.
- `search.ts` still reads provider secrets/config from env vars (`search.ts:18-23`, `search.ts:128-170`, `search.ts:205-220`).

# API inventory

## Current exports and helpers the agent will rewrite

From `packages/browser-tools/extensions/browser-tools/markdown.ts`:

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

From `packages/browser-tools/extensions/browser-tools/search.ts`:

```ts
export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchOptions = {
  allowed_domains?: string[];
  blocked_domains?: string[];
  signal?: AbortSignal;
};

export async function webSearch(
  query: string,
  options: WebSearchOptions = {},
): Promise<{ results: SearchResult[] }>;
```

## Target public tool schemas for this slice

The implementing agent should land this exact mixed-prefix tool family:

```ts
web_search {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

browser_read {
  url: string;
}

browser_navigate {
  url: string;
}

browser_observe {
  instruction: string;
}

browser_act {
  action: string;
}

browser_extract {
  instruction?: string;
}

browser_screenshot {
  url?: string;
  viewport?: 'desktop' | 'mobile';
  width?: number;
  height?: number;
  fullPage?: boolean;
}

browser_console {
  level?: Array<'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'page-error'>;
  clear?: boolean;
}
```

Notes:

- `browser_read` is the renamed replacement for `web_visit`.
- `browser_read` must be fetch/readability-first and must **not** silently boot the Stagehand runtime.
- For JavaScript-heavy pages, the new recommended flow is `browser_navigate` + `browser_extract`, not a hidden render fallback.

## Stagehand runtime APIs to call

From the Stagehand docs already gathered in this session:

```ts
const page = stagehand.context.pages()[0];
await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
const observations = await stagehand.observe('find the pricing table');
await stagehand.act('click sign in');
const extraction = await stagehand.extract({});
const image = await page.screenshot({ fullPage: true });
page.on('console', (message) => { ... });
await page.setViewportSize(1920, 1080);
```

# Tasks

## 1. Rewrite `index.ts` to register the mixed-prefix Stagehand tool set and update `/browser` to use the new runtime

### Files
- Modify `packages/browser-tools/extensions/browser-tools/index.ts`

### What to change
- Keep `web_search` as the search/discovery tool.
- Remove registrations for:
  - `web_visit`
  - `web_screenshot`
  - `web_interact`
  - `web_console`
- Add registrations for:
  - `browser_read`
  - `browser_navigate`
  - `browser_observe`
  - `browser_act`
  - `browser_extract`
  - `browser_screenshot`
  - `browser_console`
- Switch runtime imports from the old Playwright module to `./stagehand-runtime.js` introduced in slice 1.
- Rewrite prompt guidelines so they teach this flow:
  - `web_search` to discover pages
  - `browser_read` for cheap text-first reading
  - `browser_navigate` / `browser_observe` / `browser_act` / `browser_extract` for interactive pages
  - `browser_screenshot` and `browser_console` for visual/runtime debugging
- Update `/browser` so it reports the new Stagehand runtime status and keeps the existing `session_shutdown` cleanup behavior.

### Response-shape guidance
- `browser_navigate` should return text/details that include the resolved URL.
- `browser_observe`, `browser_act`, and `browser_extract` should format results as text plus structured `details`, following the thin-wrapper approach used in the MCP repo’s `act.ts`, `observe.ts`, and `extract.ts`.
- `browser_screenshot` should keep the current image-result pattern from `index.ts:200-214`, extended with optional `fullPage` support.
- `browser_console` should preserve the current `count` / `levels` / `cleared` details shape from `index.ts:358-389`.

## 2. Simplify `markdown.ts` into a fetch/readability-only read helper and remove Playwright render fallback behavior

### Files
- Modify `packages/browser-tools/extensions/browser-tools/markdown.ts`

### What to change
- Keep the existing readability pipeline (`readabilityFromHtml()`, `articleHtmlToMarkdown()`, truncation helpers) because it already works and does not depend on the browser runtime.
- Remove `renderWithPlaywright()` entirely.
- Keep or rename `fetchAsMarkdown()` so the module exports only a text-first HTTP/readability helper.
- Make the result type single-purpose; after this slice there should be no `'playwright'` method branch in the read helper.

Target helper signature after rewrite:

```ts
export async function fetchAsMarkdown(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<{ markdown: string; title: string; method: 'fetch'; url: string }>;
```

### Behavioral rule
- `browser_read` must never silently escalate into a browser session.
- If the page is JS-heavy and the fetched HTML is weak, the tool should still return the fetch-based output; callers can explicitly choose `browser_navigate` + `browser_extract`.

## 3. Move search configuration off environment variables, delete Playwright-only interaction helpers, and finish the runtime import switch

### Files
- Modify `packages/browser-tools/extensions/browser-tools/search.ts`
- Modify `packages/browser-tools/extensions/browser-tools/index.ts`
- Delete `packages/browser-tools/extensions/browser-tools/core.ts` after all imports have moved to `stagehand-runtime.ts`

### What to change
- Replace the `env` lookup in `search.ts:18-23` with config values from the browser-tools settings loader created in slice 1.
- Use the config-only provider settings for:
  - provider selection
  - Google CSE credentials
  - Brave Search credentials
- Remove `resolveLocator()` from `index.ts:66-93` and all selector/text/value action enums that only existed for the Playwright-specific `web_interact` tool.
- Update all error messages that still reference `web_visit` or `render:true` so they point to the new mixed-prefix flow.
- After `index.ts` no longer imports `./core.js`, delete `core.ts` to avoid keeping a dead Playwright runtime around.

# Files to create

- None in this slice if slice 1 already added the Stagehand runtime/config modules

# Files to modify

- `packages/browser-tools/extensions/browser-tools/index.ts` — replace the public tool surface and prompt guidance
- `packages/browser-tools/extensions/browser-tools/markdown.ts` — remove browser-render fallback behavior
- `packages/browser-tools/extensions/browser-tools/search.ts` — switch to config-only settings

# Files to remove

- `packages/browser-tools/extensions/browser-tools/core.ts` — delete after all imports are switched to `stagehand-runtime.ts`

# Testing notes

- Run `bun run --filter '@dreki-gg/pi-browser-tools' typecheck` after the tool rewrite.
- Manually verify that the package still loads and registers the expected tools before the smoke-matrix slice adds repeatable coverage.
- Check that no string in the codebase still suggests `render: true`, `web_visit`, or `web_interact` after the rewrite.

# Patterns to follow

- `packages/browser-tools/extensions/browser-tools/index.ts:43-63` — compact formatting helpers for tool output
- `packages/browser-tools/extensions/browser-tools/index.ts:358-389` — existing console result details shape to preserve
- `packages/browser-tools/extensions/browser-tools/markdown.ts:12-85` — fetch/readability path to preserve
- `packages/browser-tools/extensions/browser-tools/search.ts:47-79` — result filtering/dedup logic to preserve
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/navigate.ts:18-55` — Stagehand navigate wrapper
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/act.ts:18-46` — Stagehand act wrapper
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/observe.ts:18-46` — Stagehand observe wrapper
- `/Users/jalbarran/fun/drekki/mcp-server-browserbase/src/tools/extract.ts:18-48` — Stagehand extract wrapper
