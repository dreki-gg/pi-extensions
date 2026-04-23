# Manual parity matrix

Last updated: 2026-04-22

This runbook compares the current public `browser-tools` surface against the same deterministic local fixture for both supported browser backends:

- `playwright`
- `agent-browser`

The parity target is the existing public tool surface, not backend-private helpers:

- `web_visit`
- `web_screenshot`
- `web_interact`
- `web_console`

## Local fixture

Fixture file:

- `packages/browser-tools/test/manual/parity-fixture.html`

It intentionally combines the static and interactive cases in one page so backend differences are easier to attribute to the runtime instead of the target site.

Deterministic behaviors provided by the fixture:

- article content with stable marker `PARITY-FIXTURE-MARKER-2026-04-22`
- button with stable text and selector: `#toggle-button`
- text input with stable selector: `#name-input`
- select element with stable selector: `#flavor-select`
- load-time `console.log`, `console.warn`, and a deliberate page error
- interaction-time console messages for click, type, and select

## Prerequisites

From the repo root:

```bash
bun run --filter '@dreki-gg/pi-browser-tools' typecheck
bun run --filter '@dreki-gg/pi-browser-tools' lint
bun run --filter '@dreki-gg/pi-browser-tools' format:check
```

Backend prerequisites:

### Playwright

```bash
cd packages/browser-tools
bunx playwright --version
```

If the browser binary is missing:

```bash
cd packages/browser-tools
bunx playwright install chromium
```

### agent-browser

```bash
agent-browser --version
agent-browser doctor --offline --quick --json
```

If unavailable, install and initialize it:

```bash
brew install agent-browser && agent-browser install
# or
npm install -g agent-browser && agent-browser install
```

## Serving the fixture

### Preferred: use the local parity helper

The helper starts a local HTTP server, runs the scenarios against the public tool entrypoint, and prints JSON results:

```bash
PI_BROWSER_BACKEND=playwright bun packages/browser-tools/test/manual/run-parity.ts
PI_BROWSER_BACKEND=agent-browser bun packages/browser-tools/test/manual/run-parity.ts
```

If port `4173` is already in use, override it:

```bash
PI_BROWSER_BACKEND=playwright PI_BROWSER_TOOLS_PARITY_PORT=43173 bun packages/browser-tools/test/manual/run-parity.ts
```

Helper file:

- `packages/browser-tools/test/manual/run-parity.ts`

### Manual fallback

If you want to drive the scenarios by hand, serve the fixture directory directly:

```bash
python3 -m http.server 4173 --directory packages/browser-tools/test/manual
```

Fixture URL:

```text
http://127.0.0.1:4173/parity-fixture.html
```

## Backend selection

```bash
export PI_BROWSER_BACKEND=playwright
# or
export PI_BROWSER_BACKEND=agent-browser
```

Notes:

- unset or invalid values fall back to `playwright`
- `agent-browser` requires the external CLI to be present in `PATH`
- `web_interact.text` is treated as best-effort parity, not stronger than selector-based automation

## Matrix

Use the same input values for both backends.

| Scenario | Backend | Input | Expected visible outcome | Expected details shape | Notes |
|---|---|---|---|---|---|
| `web_visit` fetch | both | `{ url, render: false }` | markdown includes fixture title and stable marker | `details.method === 'fetch'`, `details.url`, `details.title`, `details.length`, `details.backend` | Fixture article is intentionally long enough to avoid the thin-markdown browser fallback |
| `web_visit` render | both | `{ url, render: true }` | markdown includes fixture title and article body | `details.method === backend`, `details.url`, `details.title`, `details.length`, `details.backend` | Compare title/markdown similarity, not byte-for-byte identity |
| `web_screenshot` desktop | both | `{ url, viewport: 'desktop' }` | desktop screenshot of fixture page | `details.viewport.width === 1280`, `details.viewport.height === 800`, `details.backend`, `details.url` | Confirms open-session path |
| `web_screenshot` mobile | both | `{ url, viewport: 'mobile' }` | mobile screenshot of same fixture page | `details.viewport.width === 390`, `details.viewport.height === 844`, `details.backend`, `details.url` | Confirms preset mapping parity |
| `web_console` before clear | both | open fixture first, then `{}` | output contains ready log, warning, and page error | `details.count > 0`, `details.levels`, `details.cleared === false`, `details.backend` | Ordering can differ slightly on `agent-browser` |
| `web_console` after clear | both | `{ clear: true }`, then `{}` | second read reports empty buffer | first call returns prior entries; second call reports `count === 0` | Accept minor text differences in empty-state message |
| `web_interact` click by selector | both | `{ action: 'click', selector: '#toggle-button' }` | button status flips to `on` | `details.action === 'click'`, `details.url`, `details.viewport`, `details.backend` | Validate effect via follow-up screenshot and console message |
| `web_interact` type by selector | both | `{ action: 'type', selector: '#name-input', value: 'parity-run' }` | typed status shows `parity-run` | `details.action === 'type'`, `details.url`, `details.viewport`, `details.backend` | Validate effect via console message |
| `web_interact` select by selector | both | `{ action: 'select', selector: '#flavor-select', value: 'beta' }` | select status shows `beta` | `details.action === 'select'`, `details.url`, `details.viewport`, `details.backend` | Validate effect via console message |
| `web_interact` click by text | both | `{ action: 'click', text: 'Toggle state' }` | same as selector click if text resolution works | `details.action === 'click'`, `details.url`, `details.viewport`, `details.backend` | Explicitly record whether `agent-browser` needed fallback to selector |

## Recording results

Write the final evidence to:

- `packages/browser-tools/docs/manual-parity-results.md`

For each row/backend pair, record:

- pass or fail
- exact error text if it failed
- whether the details payload remained compatible
- whether visible-text targeting worked directly or required selector fallback
- any material console-output differences

Then use that evidence to update:

- `packages/browser-tools/docs/packaging-decision.md`
