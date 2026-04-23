# @dreki-gg/pi-browser-tools

## Unreleased

- Add browser backend selection via `PI_BROWSER_BACKEND` with `playwright` as the default and `agent-browser` as an opt-in backend.
- Route `web_visit`, `web_screenshot`, `web_interact`, `web_console`, and `/browser` through the selected backend.
- Add additive `details.backend` fields for browser-backed tool results and allow `web_visit.details.method` to be `agent-browser`.
- Document `agent-browser` install requirements and the current compatibility gaps around best-effort text targeting and console normalization.

## 0.1.0

- Initial release.
- Add browser automation and web research tools for pi: `web_search`, `web_visit`, `web_screenshot`, `web_interact`, `web_console`, and `/browser`.
