# agent-browser compatibility notes

`@dreki-gg/pi-browser-tools` can run with either browser backend:

```bash
export PI_BROWSER_BACKEND=playwright
# or
export PI_BROWSER_BACKEND=agent-browser
```

If `PI_BROWSER_BACKEND` is unset or invalid, the package falls back to `playwright`.

## agent-browser install requirement

The `agent-browser` backend requires a local CLI install plus its first-run browser setup:

```bash
# Homebrew
brew install agent-browser && agent-browser install

# or npm
npm install -g agent-browser && agent-browser install
```

If `agent-browser` is selected but unavailable, browser-backed tools fail with this guidance instead of silently falling back.

## Known compatibility gaps

### `web_interact.text` is best-effort on `agent-browser`

The public tool contract still accepts:

```ts
text?: string
```

Behavior differs by backend:

- `playwright`: keeps exact-text, fuzzy-text, and role-based fallback matching.
- `agent-browser`: resolves text targets from interactive snapshot data when possible.

For reliable automation on both backends, prefer `selector`. When `agent-browser` cannot resolve a unique text target, it fails clearly and recommends using `selector` instead.

### `web_console` may differ slightly on `agent-browser`

`agent-browser` currently builds console output by combining CLI `console` and `errors` data. That means:

- ordering can differ slightly from Playwright
- some level attribution may differ slightly from Playwright
- page errors are still surfaced as `page-error`

The public result shape stays the same, with an additive `details.backend` field.

### `web_visit.details.method` can now be `agent-browser`

`web_visit.details.method` was previously effectively `fetch | playwright`.
It can now be:

- `fetch`
- `playwright`
- `agent-browser`

`details.backend` reports the selected browser backend for browser-backed tools.

## Compatibility policy for this slice

- Tool names and arguments stay the same.
- `selector` remains the preferred cross-backend targeting mechanism.
- `text` remains best-effort, not guaranteed.
- `scroll` remains vertical-only because that matches the existing public contract.
- No packaging rename or split decision is made in this slice.
