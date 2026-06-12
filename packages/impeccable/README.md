# @dreki-gg/pi-impeccable

Design guidance and deterministic anti-pattern detection for [pi](https://github.com/earendil-works/pi). A native port of [impeccable](https://github.com/pbakaus/impeccable) — the design language that makes AI coding agents better at frontend design.

Instead of shelling out to a CLI, this extension registers:

- **`impeccable_detect`** — a tool that runs 41 deterministic design anti-pattern rules over your source files (HTML/CSS/JSX/TSX). No browser, no API key, no network.
- **`/impeccable`** — a native command that routes design intents (`audit`, `critique`, `polish`, `bolder`, …) to focused playbooks.
- A **skill** carrying the design guidance and per-command references, auto-loaded as context.

URL and rendered-DOM checks reuse pi's native `web_*` tools rather than bundling a browser.

## Install

```bash
pi install npm:@dreki-gg/pi-impeccable
```

## Usage

```
/impeccable              # context-aware menu of recommended commands
/impeccable init         # set up PRODUCT.md / DESIGN.md project context
/impeccable audit blog   # technical quality checks on a surface
/impeccable critique     # UX design review
/impeccable polish form  # final pass before shipping
```

The agent can also call `impeccable_detect` directly to scan changed files for design slop.

## Credits & License

Ported from [impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus. The detection engine and design-guidance content are derived works under the **Apache License, Version 2.0**. See [`NOTICE`](./NOTICE).
