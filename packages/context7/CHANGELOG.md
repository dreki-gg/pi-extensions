# @dreki-gg/pi-context7

## 0.1.6

### Patch Changes

- [`0be7b68`](https://github.com/dreki-gg/pi-extensions/commit/0be7b6877e9874b46c756b58c99d599db623ef11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Migrate TypeBox usage and session replacement flows for Pi 0.69 compatibility.

  - switch extension imports from `@sinclair/typebox` to `typebox`
  - update package peer dependencies to require `typebox`
  - move subagent `/run-agent` fork-at follow-up work into `withSession` so post-fork operations use the replacement session safely
  - add command argument completions for `/run-agent`, `/delegate-agents`, `/preset`, `/mode`, and `/plan`
  - align local development dependencies with Pi 0.69 for typechecking and compatibility checks

## 0.1.5

### Patch Changes

- [`5e853af`](https://github.com/dreki-gg/pi-extensions/commit/5e853af054a31c4bf87d80f944513e537a39201d) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Sync the extensions repo with Pi 0.68.0 and improve direct agent runs.

  - `@dreki-gg/pi-context7`: remove stale alias docs and align compatibility tests with the canonical tool names actually exported.
  - `@dreki-gg/pi-modes`: use `before_agent_start.systemPromptOptions.selectedTools` when available so mode prompt text reflects the active prompt tool set.
  - `@dreki-gg/pi-subagent`: add `/run-agent`, support `sessionStrategy: fork-at` in agent frontmatter, default bundled `worker` and `reviewer` to forked direct runs, and add a custom renderer for run summaries.

## 0.1.4

### Patch Changes

- [`15559e4`](https://github.com/dreki-gg/pi-extensions/commit/15559e4d3392e4b5e1779cf191a69725f029a22b) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Fix Context7 config loading to read from Pi's global extension directory (`~/.pi/agent/extensions/context7`) instead of the installed npm package directory. This restores `apiKey` detection from `config.json`, ensures authenticated requests include the Authorization header, and prevents unexpected rate limiting when a key is already configured.

## 0.1.3

### Patch Changes

- [`147eb20`](https://github.com/dreki-gg/pi-extensions/commit/147eb205ace0f842da2f2823a3a3fe163ee29ad5) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Improve compatibility with newer PI releases.

  - `@dreki-gg/pi-delegate`: limit bundled agent bootstrap work to startup/reload-compatible session starts.
  - `@dreki-gg/pi-context7`: tighten tool definitions and alias argument normalization for PI compatibility.

## 0.1.2

### Patch Changes

- [`53809f8`](https://github.com/dreki-gg/pi-extensions/commit/53809f83cdf054d1eb58c577903a1d2619a2a654) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add repository.url to package.json for npm provenance verification

## 0.1.1

### Patch Changes

- [`b1e603c`](https://github.com/dreki-gg/pi-extensions/commit/b1e603c9dab1837eed39880c0455b553deab5cb0) Thanks [@jalbarrang](https://github.com/jalbarrang)! - init packages
