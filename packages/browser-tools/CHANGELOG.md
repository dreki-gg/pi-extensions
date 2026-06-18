# @dreki-gg/pi-browser-tools

## 0.6.0

### Minor Changes

- Drive an already-running, authenticated Chrome via CDP instead of launching a
  fresh browser. Start Chrome with `--remote-debugging-port=9222` and pass
  `cdp: "localhost:9222"` (a bare port, `host:port`, or ws/http URL) to any web
  tool, or set the `PI_BROWSER_CDP` env var as a default. The connection binds
  once per session and the connected browser is never auto-closed on shutdown, so
  your logged-in session stays intact. A failed connect now explains the Chrome
  136+ default-profile caveat with the exact relaunch and verify commands instead
  of surfacing a raw CDP discovery error.

## 0.5.0

### Minor Changes

- Drive an already-running, authenticated Chrome via CDP instead of launching a
  fresh browser. Start Chrome with `--remote-debugging-port=9222` and pass
  `cdp: "localhost:9222"` (a bare port, `host:port`, or ws/http URL) to
  `web_screenshot`/`web_visit`, or set the `PI_BROWSER_CDP` env var as a default.
  The connection binds once per session and the connected browser is never
  auto-closed on shutdown, so your logged-in session stays intact.

## 0.4.4

### Patch Changes

- 270f5c3: Encode browser screenshots as JPEG instead of PNG. PNG screenshots are large,
  and a long browsing session accumulates enough of them to exceed the API's total
  request-size limit (HTTP 413). Re-encoding to JPEG (quality 80, after the
  existing dimension cap) shrinks each screenshot substantially — full-page
  captures drop from megabytes to tens of KB — while keeping UI text crisp.

## 0.4.3

### Patch Changes

- 0690f27: Fix browser tools hanging indefinitely on Windows. The agent-browser CLI runner
  now settles on the process `exit` event instead of `close`, so a persistent
  browser daemon that inherits stdout/stderr handles (the default on Windows) no
  longer keeps the call open forever. Every CLI invocation also gets a hard
  timeout that turns a wedged browser into a clear, actionable error instead of a
  frozen agent.

## 0.4.2

### Patch Changes

- Downscale browser screenshots so their longest edge stays at most 1568px before
  they reach the model. Retina and full-page captures previously exceeded
  Anthropic's 2000px "many-image" limit, hard-failing long browsing sessions with
  `image dimensions exceed max allowed size`. Capping the dimensions fixes that and
  also reduces image tokens.

## 0.4.1

### Patch Changes

- Fix spurious "agent-browser CLI is unavailable" errors on web tools. The availability check used a `doctor --offline --quick` health probe — a leftover from the pre-agent-browser (Playwright) era — which is absent on some shipping CLI builds (e.g. the native 0.19.x binary), so a perfectly working CLI was reported as missing on every `web_visit`/`web_screenshot`/`web_interact`/`web_console` call. Replaced it with a lightweight `session list` liveness probe that is supported across agent-browser versions. A genuinely missing executable still surfaces the detailed install guidance.

## 0.4.0

### Minor Changes

- Drop the Playwright backend — `agent-browser` is now the only browser runtime. The `PI_BROWSER_BACKEND` selection logic (and silent `auto` fallback) is gone, so browser-backed tools hard-fail with install guidance when the `agent-browser` CLI is unavailable.

  Removed the 30s idle auto-close timer. The browser session is now a durable singleton reused across tool calls until the pi session shuts down, fixing intermittent `Browser is not open` errors when long gaps occur between `web_screenshot` and `web_interact`/`web_console`.

  `web_interact` text targeting now uses a tiered resolver: exact accessible name, exact visible text, then case-insensitive substring on each. Each tier only accepts a unique match (ambiguous text still throws), so labels like `"Echoes of Home"` resolve against an `img` alt of `"Echoes of Home — play"` without needing a selector.

## 0.3.0

### Minor Changes

- Drop the Playwright backend — `agent-browser` is now the only browser runtime. The `PI_BROWSER_BACKEND` selection logic (and silent `auto` fallback) is gone, so browser-backed tools hard-fail with install guidance when the `agent-browser` CLI is unavailable.

  Also removed the 30s idle auto-close timer. The browser session is now a durable singleton reused across tool calls until the pi session shuts down, fixing intermittent `Browser is not open` errors when long gaps occur between `web_screenshot` and `web_interact`/`web_console`.

## 0.2.0

### Minor Changes

- Default to the `agent-browser` backend with automatic Playwright fallback, and add optional vision-model screenshot analysis.

  - When `PI_BROWSER_BACKEND` is unset, prefer `agent-browser` when it is installed and healthy, otherwise silently fall back to `playwright`. Explicit backend selections are unchanged.
  - `web_screenshot` and `web_interact` gain opt-in `analyze` / `analyze_prompt` params that send the screenshot to a vision model (e.g. Gemini Flash) and return a text description instead of the image.
  - Configure the analysis model via `WEB_SCREENSHOT_MODEL` (`provider:modelId`, default `google:gemini-2.5-flash`) and enable analysis globally via `WEB_SCREENSHOT_ANALYZE`.

## 0.1.2

### Patch Changes

- [`32797ff`](https://github.com/dreki-gg/pi-extensions/commit/32797ff18d968e22c6c44e95c46e3393d8928cef) Thanks [@jalbarrang](https://github.com/jalbarrang)! - feat(plan-mode): add Windows compatibility — replace Unix shell commands with cross-platform Bun/Node APIs

  Plan-mode no longer shells out to `cat`, `bash`, or `mkdir` via `pi.exec()`. File I/O now uses `Bun.file()` / `Bun.write()` and `node:fs/promises` `mkdir`, making the extension fully cross-platform. Destructive and safe command pattern lists now include Windows equivalents (`del`, `rd`, `copy`, `move`, `powershell`, `dir`, `where`, `tasklist`, etc.).

  Also fixes Windows compatibility in three other packages:

  - **browser-tools**: `spawn` now uses `shell: true` on Windows so `.cmd` wrappers resolve correctly; `shellEscape` uses double-quote style on Windows; install guidance is platform-aware (Homebrew shown only on macOS).
  - **subagent**: `spawn` uses `shell: true` on Windows when the command is bare `pi`, allowing `pi.cmd` resolution.
  - **lsp**: `globalConfigPath()` now uses `os.homedir()` on Windows instead of the unreliable `process.env.HOME`.

## 0.1.1

### Patch Changes

- [`d133c3d`](https://github.com/dreki-gg/pi-extensions/commit/d133c3da917e7e5def568d27d6cde8ae8a6c00d2) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Mark pi peer dependencies as optional so npm does not auto-install pi internals when installing extension packages.

## Unreleased

- Add browser backend selection via `PI_BROWSER_BACKEND` with `playwright` as the default and `agent-browser` as an opt-in backend.
- Route `web_visit`, `web_screenshot`, `web_interact`, `web_console`, and `/browser` through the selected backend.
- Add additive `details.backend` fields for browser-backed tool results and allow `web_visit.details.method` to be `agent-browser`.
- Document `agent-browser` install requirements and the current compatibility gaps around best-effort text targeting and console normalization.

## 0.1.0

- Initial release.
- Add browser automation and web research tools for pi: `web_search`, `web_visit`, `web_screenshot`, `web_interact`, `web_console`, and `/browser`.
