# @dreki-gg/pi-questionnaire

## 0.2.5

### Patch Changes

- [`2a08c1d`](https://github.com/dreki-gg/pi-extensions/commit/2a08c1d0b10a1ca74dfab74f93dd200570537e0f) Thanks [@jalbarrang](https://github.com/jalbarrang)! - fix(questionnaire): remove `terminate: true` from successful tool result

  The questionnaire tool was returning `terminate: true` on successful completion, which caused the agent's turn to end immediately after the user submitted answers. The agent never got to process the responses and continue working. Now the agent receives the answers and continues its turn normally.

## 0.2.4

### Patch Changes

- [`54e5fd9`](https://github.com/dreki-gg/pi-extensions/commit/54e5fd9b15573fd4729f89ed85e31cd4648cb6c8) Thanks [@jalbarrang](https://github.com/jalbarrang)! - fix(questionnaire): prevent navigation keys from interrupting "Other" text input

  When typing custom text in the "Other" input field, keys like Space, Left/Right arrows, and 'r' were intercepted by tab navigation handlers instead of being sent to the text editor. This caused accidental tab switches that cleared the input mode and lost any typed text.

## 0.2.3

### Patch Changes

- [`d133c3d`](https://github.com/dreki-gg/pi-extensions/commit/d133c3da917e7e5def568d27d6cde8ae8a6c00d2) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Mark pi peer dependencies as optional so npm does not auto-install pi internals when installing extension packages.

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
