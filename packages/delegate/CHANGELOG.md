# @dreki-gg/pi-delegate

## 0.2.0

### Minor Changes

- [#22](https://github.com/dreki-gg/pi-extensions/pull/22) [`d5c55f5`](https://github.com/dreki-gg/pi-extensions/commit/d5c55f533c6e1ec65fcc1cce19537cf91854b122) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Support `thinking` frontmatter field in agent definitions to set reasoning effort level.

  - Read `thinking` from agent `.md` frontmatter and pass `--thinking <level>` to spawned pi processes
  - Update all bundled agents to use OpenAI models with thinking levels
  - Add `ux-designer` agent for frontend UI design with anti-Codex aesthetic guidelines

## 0.1.4

### Patch Changes

- [`147eb20`](https://github.com/dreki-gg/pi-extensions/commit/147eb205ace0f842da2f2823a3a3fe163ee29ad5) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Improve compatibility with newer PI releases.

  - `@dreki-gg/pi-delegate`: limit bundled agent bootstrap work to startup/reload-compatible session starts.
  - `@dreki-gg/pi-context7`: tighten tool definitions and alias argument normalization for PI compatibility.

## 0.1.3

### Patch Changes

- [`0d6fee9`](https://github.com/dreki-gg/pi-extensions/commit/0d6fee9417cbc5874ce5d212b5e6c1f2e42f5192) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Use provider-qualified model IDs in agent frontmatter to work around upstream pi model resolution bug where bare IDs (e.g. `gpt-5.4`) can resolve to the wrong provider (e.g. `azure-openai-responses` instead of `openai`).

## 0.1.2

### Patch Changes

- [`53809f8`](https://github.com/dreki-gg/pi-extensions/commit/53809f83cdf054d1eb58c577903a1d2619a2a654) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add repository.url to package.json for npm provenance verification

## 0.1.1

### Patch Changes

- [`b1e603c`](https://github.com/dreki-gg/pi-extensions/commit/b1e603c9dab1837eed39880c0455b553deab5cb0) Thanks [@jalbarrang](https://github.com/jalbarrang)! - init packages
