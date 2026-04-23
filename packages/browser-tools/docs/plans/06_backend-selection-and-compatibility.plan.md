---
name: "Backend selection + compatibility contract"
overview: "Wire the tool layer to choose between the Playwright and agent-browser backends, while keeping the existing browser-tools API mostly compatible. This slice also documents the deliberate compatibility gaps instead of hiding them."
todo:
  - id: "backend-selection-1"
    task: "Add backend selection with a Playwright default and a clear failure mode when agent-browser is requested but unavailable"
    status: pending
  - id: "backend-selection-2"
    task: "Route the existing tool surface through the selected backend while keeping compatibility where it is cheap and making additive result-shape changes explicit"
    status: pending
  - id: "backend-selection-3"
    task: "Document the selected-backend mechanism and the known compatibility gaps, especially best-effort text targeting and CLI requirements"
    status: pending
---

# Goal

Expose backend selection inside `@dreki-gg/pi-browser-tools` so the package can run on either Playwright or `agent-browser`, without renaming the public tools or pretending the two engines behave identically.

# Context

- Parent feature: add `agent-browser` as an alternative backend for the existing browser-tools package.
- This slice depends on:
  - `04_browser-backend-interface-and-playwright-adapter.plan.md`
  - `05_agent-browser-cli-backend.plan.md`
- Approved direction from the conversation:
  - keep the package name the same for now
  - preserve the current tool surface where that is cheap
  - local `agent-browser` CLI dependency is acceptable for the experiment
  - document gaps instead of redesigning the API around refs right away
- This slice is where the package actually becomes dual-backend.

## What exists

Actual current package behavior on disk today:

- There is no backend-selection mechanism anywhere in `packages/browser-tools`.
- `index.ts` still imports one concrete runtime singleton and assumes only one browser engine exists.
- `README.md` still documents a Playwright-shaped package:
  - `web_visit`
  - `web_screenshot`
  - `web_interact`
  - `web_console`
- `README.md` still says `web_visit` falls back to Playwright rendering and that `web_interact`/`web_console` require the Playwright session opened by `web_screenshot` or `web_visit render:true`.
- The package has no compatibility doc that explains any difference between Playwright and `agent-browser` behavior.

Current public inputs that must remain the primary compatibility target:

```ts
web_visit { url: string; render?: boolean }
web_screenshot { url?: string; viewport?: 'desktop' | 'mobile'; width?: number; height?: number }
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

# API inventory

## Backend selection contract for this slice

Use one explicit env var for backend selection in this first dual-backend version:

```ts
process.env.PI_BROWSER_BACKEND
```

Accepted values:

```ts
'playwright' | 'agent-browser'
```

Selection rules:

1. Default to `'playwright'` when unset or invalid.
2. If `'agent-browser'` is selected, the package must preflight the CLI and fail clearly if unavailable.
3. Do not add a package config file for backend selection in this slice. Env-var selection is the cheapest reversible choice and matches the current package’s env-var-heavy configuration style.

## Additive result-shape changes allowed in this slice

Keep the tool names and arguments stable, but additive details fields are allowed. Add a `backend` field to the details object where useful.

Recommended details shape changes:

```ts
web_visit.details.backend: 'playwright' | 'agent-browser'
web_screenshot.details.backend: 'playwright' | 'agent-browser'
web_interact.details.backend: 'playwright' | 'agent-browser'
web_console.details.backend: 'playwright' | 'agent-browser'
```

For `web_visit`, the `method` field will need to widen from:

```ts
'fetch' | 'playwright'
```

to:

```ts
'fetch' | 'playwright' | 'agent-browser'
```

This is an intentional compatibility change and must be documented.

## Compatibility policy for `web_interact.text`

Do not add a new public `ref` parameter in this slice.

Keep:

```ts
text?: string
```

as a best-effort compatibility feature with this policy:

- Playwright backend: keep the current exact-text / fuzzy-text / role fallback behavior.
- `agent-browser` backend: resolve text via `snapshot -i --json` when possible.
- If the `agent-browser` backend cannot resolve the text target reliably, fail with a clear error that recommends `selector`.
- Document this gap rather than hiding it.

# Tasks

## 1. Add backend selection with a Playwright default and a clear failure mode when agent-browser is requested but unavailable

### Files
- Create `packages/browser-tools/extensions/browser-tools/backends/select.ts`
- Modify `packages/browser-tools/extensions/browser-tools/index.ts`

### What to add
- Add a tiny selector module, for example:

```ts
export function getSelectedBrowserBackendName(): 'playwright' | 'agent-browser';
export function getSelectedBrowserBackend(): BrowserBackend;
```

- Default to Playwright when `PI_BROWSER_BACKEND` is missing or invalid.
- If `PI_BROWSER_BACKEND=agent-browser`, run the backend availability check once and fail with an install message if the CLI is missing or not initialized.
- Recommended failure message should mention both install paths:

```text
agent-browser backend selected, but the CLI is unavailable.
Install with either:
  brew install agent-browser && agent-browser install
or
  npm install -g agent-browser && agent-browser install
```

## 2. Route the existing tool surface through the selected backend while keeping compatibility where it is cheap and making additive result-shape changes explicit

### Files
- Modify `packages/browser-tools/extensions/browser-tools/index.ts`
- Modify `packages/browser-tools/extensions/browser-tools/markdown.ts` if needed for the widened `method` type

### What to change
- Keep the public tools and `/browser` command names unchanged.
- Replace direct Playwright imports with `getSelectedBrowserBackend()`.
- Keep behavior aligned to the current API:
  - `web_visit render:false` still uses `fetchAsMarkdown()`
  - `web_visit render:true` uses the selected backend’s `renderPage()`
  - the current “thin fetch result falls back to rendered visit” behavior stays in place
  - `web_screenshot`, `web_interact`, and `web_console` route through the selected backend
- Add `backend` to relevant details objects.
- Update `/browser` so its message includes the selected backend name.

### Compatibility rules to encode in code
- Prefer preserving current arg names over introducing `ref`, `instruction`, or other agent-browser-native inputs.
- Keep `selector` support first-class on both backends.
- Keep `text` best-effort, not guaranteed.
- Keep `scroll` vertical only because that is what the current tool contract supports.
- Preserve the current screenshot result format: textless image content plus details.
- Preserve the current console summary shape: `count`, `levels`, `cleared`; add `backend` as an extra field.

## 3. Document the selected-backend mechanism and the known compatibility gaps, especially best-effort text targeting and CLI requirements

### Files
- Modify `packages/browser-tools/README.md`
- Modify `packages/browser-tools/CHANGELOG.md`
- Create `packages/browser-tools/docs/agent-browser-compatibility.md`

### What to document
- The backend-selection env var:

```bash
export PI_BROWSER_BACKEND=playwright
# or
export PI_BROWSER_BACKEND=agent-browser
```

- Default behavior: Playwright when unset.
- `agent-browser` install requirement and first-run browser install.
- Known compatibility gaps:
  - `web_interact.text` is best-effort on `agent-browser`
  - `selector` is preferred for reliable automation
  - `web_console` on `agent-browser` merges `console` and `errors`, so ordering/level attribution may differ slightly from Playwright
  - `web_visit.details.method` can now be `agent-browser`
- Keep the root repo README unchanged in this slice unless the parity slice later decides the agent-browser backend is ready to advertise broadly.

# Files to create

- `packages/browser-tools/extensions/browser-tools/backends/select.ts`
- `packages/browser-tools/docs/agent-browser-compatibility.md`

# Files to modify

- `packages/browser-tools/extensions/browser-tools/index.ts` — selected backend wiring
- `packages/browser-tools/extensions/browser-tools/markdown.ts` — widened rendered method typing if needed
- `packages/browser-tools/README.md` — backend-selection docs
- `packages/browser-tools/CHANGELOG.md` — dual-backend entry

# Testing notes

- Validate both selection modes explicitly:

```bash
PI_BROWSER_BACKEND=playwright bun run --filter '@dreki-gg/pi-browser-tools' typecheck
PI_BROWSER_BACKEND=agent-browser bun run --filter '@dreki-gg/pi-browser-tools' typecheck
```

- Manual checks should confirm:
  - default selection is Playwright
  - invalid env values fall back to Playwright instead of crashing mysteriously
  - missing `agent-browser` CLI yields the explicit install error
  - details payloads include the selected backend name

# Patterns to follow

- `packages/browser-tools/extensions/browser-tools/index.ts` — current public tool/result shapes to preserve
- `packages/browser-tools/README.md` — current user-facing install/config docs to update in place
- `packages/browser-tools/extensions/browser-tools/search.ts` — existing env-var-driven package style that makes env-based backend selection the smallest change now
