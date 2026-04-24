# @dreki-gg/pi-questionnaire

## 0.2.2

### Patch Changes

- [`0be7b68`](https://github.com/dreki-gg/pi-extensions/commit/0be7b6877e9874b46c756b58c99d599db623ef11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Migrate TypeBox usage and session replacement flows for Pi 0.69 compatibility.

  - switch extension imports from `@sinclair/typebox` to `typebox`
  - update package peer dependencies to require `typebox`
  - move subagent `/run-agent` fork-at follow-up work into `withSession` so post-fork operations use the replacement session safely
  - add command argument completions for `/run-agent`, `/delegate-agents`, `/preset`, `/mode`, and `/plan`
  - align local development dependencies with Pi 0.69 for typechecking and compatibility checks

## 0.2.1

### Patch Changes

- [`8121a65`](https://github.com/dreki-gg/pi-extensions/commit/8121a65d312e9e9688762c713976c83dd3ac9d99) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add prompt guideline to prefer questionnaire tool over plain text when questions have clear, enumerable options.

## 0.2.0

### Minor Changes

- [`5518034`](https://github.com/dreki-gg/pi-extensions/commit/55180341a31ef185d82c200ea2873e7c97f332ae) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add @dreki-gg/pi-questionnaire — structured questions tool for pi.

  - `questionnaire` tool: 1–5 questions per call, single/multi-select, optional Other free-text
  - Tabbed TUI with Review tab, keyboard-driven navigation, layered Esc cancel
  - `/questionnaire` demo command
  - Custom renderCall and renderResult (collapsed + expanded)
