# @dreki-gg/pi-modes

## 0.1.2

### Patch Changes

- [`5e853af`](https://github.com/dreki-gg/pi-extensions/commit/5e853af054a31c4bf87d80f944513e537a39201d) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Sync the extensions repo with Pi 0.68.0 and improve direct agent runs.

  - `@dreki-gg/pi-context7`: remove stale alias docs and align compatibility tests with the canonical tool names actually exported.
  - `@dreki-gg/pi-modes`: use `before_agent_start.systemPromptOptions.selectedTools` when available so mode prompt text reflects the active prompt tool set.
  - `@dreki-gg/pi-subagent`: add `/run-agent`, support `sessionStrategy: fork-at` in agent frontmatter, default bundled `worker` and `reviewer` to forked direct runs, and add a custom renderer for run summaries.

## 0.1.1

### Patch Changes

- [`132122a`](https://github.com/dreki-gg/pi-extensions/commit/132122a4be60869d0bd17c21e673904f4533d938) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Polish `@dreki-gg/pi-modes` for publishing:

  - bootstrap starter global presets on first run by creating or augmenting `~/.pi/agent/presets.json`
  - avoid slash-alias collisions with existing commands/templates/skills
  - tighten npm package contents with an explicit `files` allowlist
  - improve npm metadata and README notes

## 0.1.0

- Initial release
- Config-driven preset/mode switching for pi
- Hard-enforced tool whitelists via `pi.setActiveTools()`
- `--preset <name>`, `/preset`, `/mode`, `/modes`, and slash aliases like `/explore`
- Session persistence with global + project config merging
