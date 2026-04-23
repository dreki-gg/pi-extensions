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

Default browser backend: Playwright.

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

## Browser backend selection

Use `PI_BROWSER_BACKEND` to choose the browser runtime:

```bash
export PI_BROWSER_BACKEND=playwright
# or
export PI_BROWSER_BACKEND=agent-browser
```

- Unset or invalid values fall back to `playwright`.
- If `agent-browser` is selected but unavailable, browser-backed tools fail with install guidance.

## Notes

- `web_visit` uses plain fetch by default and falls back to the selected browser backend when the fetched markdown is too thin.
- `web_interact` and `web_console` require an open browser session. Open one first with `web_screenshot` or `web_visit` using `render: true`.
- `web_interact.text` is best-effort on `agent-browser`; prefer `selector` for reliable automation.
- `web_console` on `agent-browser` merges console messages and page errors, so ordering and level attribution may differ slightly from Playwright.
- `web_visit.details.method` can now be `fetch`, `playwright`, or `agent-browser`.
- Browser sessions auto-close after a short idle timeout.
- See [`docs/agent-browser-compatibility.md`](./docs/agent-browser-compatibility.md) for known gaps and backend-specific notes.
