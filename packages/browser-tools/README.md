# @dreki-gg/pi-browser-tools

Browser automation and web research tools for pi.

It adds:
- `web_search` for search-engine-backed web discovery
- `web_visit` for readable markdown extraction via fetch or the selected browser backend
- `web_screenshot` for browser screenshots at desktop or mobile sizes
- `web_interact` for click/type/select/scroll/hover/wait actions on the open page
- `web_console` for captured browser logs, warnings, and uncaught page errors
- `/browser` for a quick browser status check

## Install

```bash
pi install npm:@dreki-gg/pi-browser-tools
```

Browser backend: `agent-browser` (see [Browser backend](#browser-backend)).

Optional `agent-browser` backend setup:

```bash
# Homebrew
brew install agent-browser && agent-browser install

# or npm
npm install -g agent-browser && agent-browser install
```

## Tools

| Tool | Description |
|------|-------------|
| `web_search` | Search the web and return up to 10 filtered results |
| `web_visit` | Fetch a URL and convert it to readable markdown, with optional browser rendering |
| `web_screenshot` | Take a screenshot of the current page or navigate to a URL first |
| `web_interact` | Interact with the current browser page and return a fresh screenshot |
| `web_console` | Read captured browser console output, warnings, errors, and uncaught page errors |

## Search providers

Default provider: DuckDuckGo HTML.

Optional env vars:

```bash
# Select provider: duckduckgo | google | brave
export WEB_SEARCH_PROVIDER=duckduckgo

# Google Custom Search
export GOOGLE_CSE_API_KEY=...
export GOOGLE_CSE_ID=...

# Brave Search
export BRAVE_SEARCH_API_KEY=...
```

If `WEB_SEARCH_PROVIDER=google`, both `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_ID` are required.
If `WEB_SEARCH_PROVIDER=brave`, `BRAVE_SEARCH_API_KEY` is required.

## Browser backend

Browser-backed tools use [`agent-browser`](https://github.com/agent-browser/agent-browser) as the only runtime. Install it with:

```bash
# macOS
brew install agent-browser && agent-browser install
# or any platform
npm install -g agent-browser && agent-browser install
```

If `agent-browser` is unavailable, browser-backed tools fail with install guidance.

## Screenshot analysis (vision model)

`web_screenshot` and `web_interact` can optionally hand the screenshot to a vision
model (e.g. Gemini Flash) and return a **text description instead of the image** —
useful for letting a multimodal model recognize forms, shapes, and layout.

- Per-call opt-in: pass `analyze: true` (and optionally `analyze_prompt: "..."`).
- Global default: set `WEB_SCREENSHOT_ANALYZE=1` (truthy: `1`, `true`, `yes`, `on`).
  An explicit `analyze` param always overrides the env default.
- Model selection via `WEB_SCREENSHOT_MODEL` as `provider:modelId`
  (default `google:gemini-2.5-flash`; a bare value is treated as a `google` model id).

```bash
export WEB_SCREENSHOT_ANALYZE=1
export WEB_SCREENSHOT_MODEL=google:gemini-2.5-flash
```

The chosen model must have auth configured in pi (API key / OAuth) like any other model.

## Notes

- `web_visit` uses plain fetch by default and falls back to the selected browser backend when the fetched markdown is too thin.
- `web_interact` and `web_console` require an open browser session. Open one first with `web_screenshot` or `web_visit` using `render: true`.
- `web_interact.text` resolves against the accessibility snapshot using tiered matching: exact accessible name, exact visible text, then case-insensitive substring on each. A tier is only accepted when it yields a single match — ambiguous text throws and asks for a `selector`. Prefer `selector` when you need deterministic targeting.
- `web_console` on `agent-browser` merges console messages and page errors, so ordering and level attribution are best-effort.
- `web_visit.details.method` is either `fetch` or `agent-browser`.
- A browser session stays open and is reused across tool calls until the pi session ends (or `close()` is called explicitly). There is no idle auto-close, so `web_interact`/`web_console` keep working after long gaps following `web_screenshot`.
- See [`docs/agent-browser-compatibility.md`](./docs/agent-browser-compatibility.md) for known gaps and backend-specific notes.
