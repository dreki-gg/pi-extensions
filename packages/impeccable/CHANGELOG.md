# @dreki-gg/pi-impeccable

## 0.2.0

### Minor Changes

- Add argument autocompletion to slash commands. Typing after `/impeccable`,
  `/stack`, `/babysit`, `/pr-canvas`, `/context-folders`, or `/past-chats` now
  suggests the available sub-commands (filtered by prefix, with descriptions),
  so you no longer have to remember the exact verb to type.

## 0.1.0

### Minor Changes

- Add `@dreki-gg/pi-impeccable` — a native pi port of [impeccable](https://github.com/pbakaus/impeccable), the design language for AI coding agents.

  - **`impeccable_detect` tool** runs impeccable's 41 deterministic design anti-pattern rules over your source files (HTML/CSS/JSX/TSX) — side-stripe borders, gradient text, overused fonts, cramped tracking, low-contrast text, and more. No browser, API key, or network; defaults to scanning your changed files.
  - **`/impeccable` command** routes design intents (`audit`, `critique`, `polish`, `bolder`, …) to focused playbooks, with a context-aware menu when run bare.
  - Ships the impeccable design guidance and 27 reference playbooks as a skill.

  Rendered-page and URL checks reuse pi's native `web_*` tools instead of bundling a browser. Ported under Apache-2.0 with upstream attribution (see `NOTICE`).
