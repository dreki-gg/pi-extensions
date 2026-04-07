# @dreki-gg/pi-modes

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
