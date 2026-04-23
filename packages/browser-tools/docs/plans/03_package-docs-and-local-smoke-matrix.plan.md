---
name: "Package docs + local smoke matrix"
overview: "Finalize the Stagehand migration by cleaning up dependencies, documenting the new mixed-prefix local-only package behavior, and adding a repeatable local smoke matrix for the new runtime tools."
todo:
  - id: "docs-smoke-1"
    task: "Clean up package dependencies and scripts after the tool migration"
    status: pending
  - id: "docs-smoke-2"
    task: "Update package and repo docs for Stagehand LOCAL mode, config-only secrets, and the new tool names"
    status: pending
  - id: "docs-smoke-3"
    task: "Add a local smoke matrix harness that exercises the new Stagehand-backed browser_* tools against a deterministic fixture page"
    status: pending
---

# Goal

Finish the browser-tools Stagehand migration with clear docs, a clean manifest, and a developer-run smoke matrix that proves the new runtime and tool surface work locally without Browserbase.

# Context

- Parent feature: direct Stagehand SDK integration for `@dreki-gg/pi-browser-tools`.
- This plan depends on:
  - `01_stagehand-local-runtime-and-config.plan.md`
  - `02_stagehand-tool-surface-and-reading-split.plan.md`
- Approved product decisions to reflect in docs:
  - local-only Stagehand runtime (`env: 'LOCAL'`)
  - no MCP runtime layer
  - no Browserbase API key requirement
  - config-file-only secrets/config for browser-tools
  - mixed-prefix tool naming (`web_search` + `browser_*`)

## What exists

Actual current package/repo state:

- `packages/browser-tools/package.json:26-30` has no test or smoke script.
- `packages/browser-tools/package.json:37-42` still depends on `playwright` and does not yet depend on `@browserbasehq/stagehand`.
- `packages/browser-tools/tsconfig.json:16` typechecks only `extensions/**/*.ts`; there is no `test/` directory today.
- `packages/browser-tools/README.md:5-54` still documents the Playwright-era tool set (`web_visit`, `web_screenshot`, `web_interact`, `web_console`) and still tells users to rely on env vars for search provider config.
- `packages/browser-tools/CHANGELOG.md:3-6` still describes the initial Playwright-shaped release.
- `README.md:11` lists the package with the old tool names.
- There is no browser-tools smoke test harness anywhere in the repo.

Useful test/documentation patterns already in the monorepo:

- `packages/lsp/package.json:16-21` shows the standard package-level `test`, `lint`, and `format` script shape.
- `packages/lsp/test/index.test.ts:38-79` shows a small fake-Pi harness pattern for calling extension tools directly.
- `packages/lsp/test/index.test.ts:90-180` shows how package-local tests set up filesystem state and then invoke extension entrypoints directly.

# API inventory

## Current package manifest surface

From `packages/browser-tools/package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint extensions",
    "format": "oxfmt --write extensions",
    "format:check": "oxfmt --check extensions"
  },
  "dependencies": {
    "@mozilla/readability": "^0.6.0",
    "linkedom": "^0.18.12",
    "playwright": "^1.59.1",
    "turndown": "^7.2.1"
  }
}
```

This will be stale after the Stagehand migration and must be cleaned up.

## Documentation facts that must change

From `packages/browser-tools/README.md`:

- tool list still references `web_visit`, `web_screenshot`, `web_interact`, `web_console`
- search configuration is documented as env-var-only
- notes still say `web_visit` falls back to Playwright and `web_interact` requires an open browser session

From `README.md`:

- the package summary still advertises the old tool names at `README.md:11`

## Smoke-matrix target capabilities

The smoke harness should cover these post-migration tools directly:

```ts
browser_read
browser_navigate
browser_screenshot
browser_console
browser_observe
browser_act
browser_extract
```

`web_search` does not need to be in the deterministic local smoke matrix because the approved Stagehand migration does not change its core network-search behavior.

# Tasks

## 1. Clean up package dependencies and scripts after the tool migration

### Files
- Modify `packages/browser-tools/package.json`
- Modify `packages/browser-tools/tsconfig.json` only if the smoke harness needs package-level typechecking support

### What to change
- Remove `playwright` after slice 2 has fully deleted the old runtime.
- Ensure `@browserbasehq/stagehand` is present in `dependencies`.
- Add the developer tooling needed for the smoke harness if required (for example `bun-types` in `devDependencies` if the smoke test uses Bun-specific globals).
- Add a package-local smoke command instead of wiring the harness into the repo’s default root test flow.

Recommended script shape:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "smoke:local": "bun test test/smoke.local.test.ts",
    "lint": "oxlint extensions test",
    "format": "oxfmt --write extensions test",
    "format:check": "oxfmt --check extensions test"
  }
}
```

Notes:

- Keep this as a **local smoke** command, not a root CI requirement, because it needs a real browser and a real model key in the browser-tools config file.
- Do not add Browserbase dependencies or MCP transport packages.

## 2. Update package and repo docs for Stagehand LOCAL mode, config-only secrets, and the new tool names

### Files
- Modify `packages/browser-tools/README.md`
- Modify `packages/browser-tools/CHANGELOG.md`
- Modify `README.md`

### What to change
- Rewrite the package README so it documents the final mixed-prefix tool family.
- Add a config example for `~/.pi/agent/extensions/browser-tools/config.json`.
- Explicitly state:
  - Browserbase API key is **not required** in local mode
  - browser-tools uses a **config file only** for secrets/config
  - `web_search` remains the discovery tool
  - `browser_read` is the fetch/readability tool
  - `browser_navigate`, `browser_observe`, `browser_act`, `browser_extract`, `browser_screenshot`, and `browser_console` are Stagehand-backed
- Update the root README package row so the public package summary matches the new tool names.
- Add a changelog entry that records the Stagehand migration and the tool rename/removal set.

Recommended README config example:

```json
{
  "stagehand": {
    "modelName": "google/gemini-2.5-flash-lite",
    "modelApiKey": "...",
    "localBrowserLaunchOptions": {
      "headless": true,
      "viewport": { "width": 1280, "height": 800 }
    }
  },
  "search": {
    "provider": "duckduckgo"
  },
  "runtime": {
    "idleTimeoutMs": 30000
  }
}
```

## 3. Add a local smoke matrix harness that exercises the new Stagehand-backed `browser_*` tools against a deterministic fixture page

### Files
- Create `packages/browser-tools/test/smoke.local.test.ts`
- Create `packages/browser-tools/test/fixtures/smoke-page.html`

### What to add
Build a repeatable, developer-run smoke matrix around a local deterministic page instead of remote websites.

Harness design:

- Follow the fake-Pi registration pattern from `packages/lsp/test/index.test.ts:38-79` so the test invokes the real extension entrypoint and real tool `execute()` methods.
- Serve `test/fixtures/smoke-page.html` from a tiny local HTTP server inside the test.
- The fixture page should include:
  - readable article content for `browser_read`
  - a visible button or control that changes page state when clicked
  - `console.log`, `console.warn`, and an intentional runtime event on load or click so `browser_console` has deterministic output
  - a simple DOM element whose text changes after interaction so `browser_extract` can verify the post-action state

Smoke matrix scenarios:

1. `browser_read` returns markdown/title for the fixture page without opening the runtime browser.
2. `browser_navigate` opens the local page through Stagehand.
3. `browser_screenshot` returns an image and viewport details.
4. `browser_console` returns the initial load logs.
5. `browser_observe` finds the actionable control.
6. `browser_act` clicks or otherwise triggers the control.
7. `browser_extract` returns the changed state after the action.
8. `browser_console` with `clear: true` empties the buffer after read.

Practical notes:

- If the config file is missing or has no `stagehand.modelApiKey`, the smoke test should skip with a clear message rather than failing mysteriously.
- Keep the harness local-only and deterministic; do not depend on DuckDuckGo/Google/Brave or public sites.

# Files to create

- `packages/browser-tools/test/smoke.local.test.ts`
- `packages/browser-tools/test/fixtures/smoke-page.html`

# Files to modify

- `packages/browser-tools/package.json` — final dependencies/scripts cleanup
- `packages/browser-tools/tsconfig.json` — only if needed for local test ergonomics
- `packages/browser-tools/README.md` — final user-facing docs
- `packages/browser-tools/CHANGELOG.md` — migration entry
- `README.md` — repo package summary

# Testing notes

- After this slice lands, the expected local validation commands are:

```bash
bun run --filter '@dreki-gg/pi-browser-tools' typecheck
bun run --filter '@dreki-gg/pi-browser-tools' smoke:local
```

- Keep the smoke harness opt-in and local. It should not be wired into the root `bun run test` command unless the repo later decides to support browser/model-backed tests in CI.

# Patterns to follow

- `packages/lsp/package.json:16-21` — package-local script layout
- `packages/lsp/test/index.test.ts:38-79` — fake Pi harness for extension tools
- `packages/lsp/test/index.test.ts:90-180` — test setup/teardown pattern for extension entrypoints
- `packages/browser-tools/README.md:19-54` — existing package README structure to rewrite in place
- `README.md:9-18` — root package table format to preserve
