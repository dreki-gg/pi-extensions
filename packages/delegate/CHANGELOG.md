# @dreki-gg/pi-delegate

## 0.2.1

### Patch Changes

- [`f9dbdf9`](https://github.com/dreki-gg/pi-extensions/commit/f9dbdf92b80992c7485d8d5fcbcf7d5fade9b46c) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Fix agent files not updating on `pi update`. Agents are now read directly from the bundled package directory instead of being copied to `~/.pi/agent/agents/` on first run. User overrides in `~/.pi/agent/agents/` still take precedence by name.

  Added `/delegate-agents` command to manage agents:

  - `/delegate-agents list` — show all agents with their source (bundled, user override, user-only)
  - `/delegate-agents reset <name|--all>` — delete user override, restoring the bundled version
  - `/delegate-agents edit <name>` — copy a bundled agent to the user directory for customization

  Removed the `bootstrapAgents()` session_start hook that was preventing bundled agent updates from reaching users.

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
