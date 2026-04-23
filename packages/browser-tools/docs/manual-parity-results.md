# Manual parity results

Run date: 2026-04-23

## Environment

- package: `@dreki-gg/pi-browser-tools`
- OS: `macOS 26.3.1 (25D2128)`
- Playwright: `1.59.1`
- agent-browser CLI: `0.26.0`
- fixture: `packages/browser-tools/test/manual/parity-fixture.html`
- helper: `packages/browser-tools/test/manual/run-parity.ts`

## Commands used

Primary matrix runs:

```bash
PI_BROWSER_BACKEND=playwright PI_BROWSER_TOOLS_PARITY_PORT=43173 \
  bun packages/browser-tools/test/manual/run-parity.ts

PI_BROWSER_BACKEND=agent-browser PI_BROWSER_TOOLS_PARITY_PORT=43174 \
  bun packages/browser-tools/test/manual/run-parity.ts
```

Supplemental console-clear verification:

- reran the full package-local parity helper for both backends after the backend fix
- confirmed `web_screenshot -> web_console -> web_console { clear: true } -> web_console` now reports an empty follow-up read on `agent-browser`

## Summary

- All planned scenarios were feasible in this environment.
- Playwright passed all 10 scenarios.
- agent-browser passed all 10 scenarios.
- The previous `web_console` after `clear: true` gap on `agent-browser` no longer reproduced in this rerun.
- `web_interact.text` succeeded on the deterministic local fixture for both backends, but that does **not** overturn the existing guidance to prefer `selector` on arbitrary pages.
- `web_visit render:true` remained shape-compatible on both backends. Output was not byte-identical:
  - Playwright rendered markdown was longer (`length: 2268`) and duplicated the page heading in this fixture.
  - agent-browser rendered markdown was shorter (`length: 606`) and closer to the fetch-based article extraction.

## Matrix results

| Scenario | Backend | Status | Details shape compatible? | Evidence / notes |
|---|---|---:|---:|---|
| `web_visit` fetch | Playwright | ✅ Pass | Yes | `details.method === 'fetch'`; title `Browser Tools Parity Fixture`; markdown contained `PARITY-FIXTURE-MARKER-2026-04-22`; `length: 606`. |
| `web_visit` fetch | agent-browser | ✅ Pass | Yes | Same fetch-path result shape as Playwright; `details.method === 'fetch'`; same title and marker; `length: 606`. |
| `web_visit` render | Playwright | ✅ Pass | Yes | `details.method === 'playwright'`; title matched fixture; readable markdown included article plus extra rendered content; `length: 2268`. |
| `web_visit` render | agent-browser | ✅ Pass | Yes | `details.method === 'agent-browser'`; title matched fixture; readable markdown preserved article body; `length: 606`. |
| `web_screenshot` desktop | Playwright | ✅ Pass | Yes | PNG returned; `details.viewport` was `1280x800`; excerpt size ≈ `97,818` bytes. |
| `web_screenshot` desktop | agent-browser | ✅ Pass | Yes | PNG returned; `details.viewport` was `1280x800`; excerpt size ≈ `99,522` bytes. |
| `web_screenshot` mobile | Playwright | ✅ Pass | Yes | PNG returned; `details.viewport` was `390x844`; excerpt size ≈ `73,290` bytes. |
| `web_screenshot` mobile | agent-browser | ✅ Pass | Yes | PNG returned; `details.viewport` was `390x844`; excerpt size ≈ `75,285` bytes. |
| `web_console` before clear | Playwright | ✅ Pass | Yes | In an isolated rerun, first read returned `count: 3` with `log`, `warn`, and `page-error`. In the sequential helper run, Playwright surfaced repeated earlier entries until explicitly cleared, which is consistent with its buffer model. |
| `web_console` before clear | agent-browser | ✅ Pass | Yes | First read returned `count: 3` with `log`, `warn`, and `page-error`. Error text was prefixed as `Error: fixture:page-error ready`. |
| `web_console` after `clear: true` | Playwright | ✅ Pass | Yes | `web_console { clear: true }` returned the prior entries, and the follow-up read returned `count: 0` with `No console output captured yet.` |
| `web_console` after `clear: true` | agent-browser | ✅ Pass | Yes | `web_console { clear: true }` returned the prior entries, and the follow-up read returned `count: 0` with `No console output captured yet.` |
| `web_interact` click by selector | Playwright | ✅ Pass | Yes | `#toggle-button` click succeeded; follow-up console output contained `fixture:button clicked:on`; `details.action === 'click'`. |
| `web_interact` click by selector | agent-browser | ✅ Pass | Yes | `#toggle-button` click succeeded; follow-up console output contained `fixture:button clicked:on`; `details.action === 'click'`. |
| `web_interact` type by selector | Playwright | ✅ Pass | Yes | `#name-input` type succeeded; follow-up console output contained `fixture:input typed:parity-run`; `details.action === 'type'`. |
| `web_interact` type by selector | agent-browser | ✅ Pass | Yes | `#name-input` type succeeded; follow-up console output contained `fixture:input typed:parity-run`; `details.action === 'type'`. |
| `web_interact` select by selector | Playwright | ✅ Pass | Yes | `#flavor-select` select succeeded; follow-up console output contained `fixture:select changed:beta`; `details.action === 'select'`. |
| `web_interact` select by selector | agent-browser | ✅ Pass | Yes | `#flavor-select` select succeeded; follow-up console output contained `fixture:select changed:beta`; `details.action === 'select'`. |
| `web_interact` click by text | Playwright | ✅ Pass | Yes | `text: 'Toggle state'` resolved directly on the fixture; no selector fallback needed in the run. |
| `web_interact` click by text | agent-browser | ✅ Pass | Yes | `text: 'Toggle state'` resolved directly on the fixture; no selector fallback needed in the run. This is encouraging, but still only local-fixture evidence. |

## Output snippets worth keeping

### `web_visit render:true`

- Playwright excerpt began with:
  - `Source: http://127.0.0.1:43173/parity-fixture.html`
  - `Method: playwright`
  - `# Browser Tools Parity Fixture`
- agent-browser excerpt began with:
  - `Source: http://127.0.0.1:43174/parity-fixture.html`
  - `Method: agent-browser`
  - `# Browser Tools Parity Fixture`

### `web_console` clear behavior on agent-browser

Observed in the rerun:

```text
before: count=3 levels={log:1,warn:1,page-error:1}
clear:  count=3 levels={log:1,warn:1,page-error:1}
after:  count=0 levels={}
```

Follow-up read:

```text
No console output captured yet.
```

## Judgments captured from the run

### Is `web_interact.text` good enough as best-effort for `agent-browser`?

On this deterministic fixture: yes.

For broader public packaging claims: still best-effort only. The local success is enough to avoid treating text targeting as an immediate blocker, but not enough to upgrade the guidance over `selector`.

### Is `web_visit render:true` sufficiently similar on both backends?

Yes. Title, shape, and readability were compatible enough for the current public API. The content extraction strategies are visibly different, but not in a way that broke the tool contract on this fixture.

### Is the CLI requirement acceptable for the package audience?

Acceptable only as an opt-in backend, not as the default or the headline install story. The extra global CLI dependency increases support burden, but that burden does **not** justify a separate package on its own.
