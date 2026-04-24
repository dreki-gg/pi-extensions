# @dreki-gg/pi-subagent

## 0.7.0

### Minor Changes

- [`0be7b68`](https://github.com/dreki-gg/pi-extensions/commit/0be7b6877e9874b46c756b58c99d599db623ef11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Remove the `/delegate` command from `@dreki-gg/pi-subagent`.

  - keep the `subagent` tool as the primary orchestration surface
  - keep `/run-agent` for direct named-agent runs
  - keep `/delegate-agents` for agent management
  - update docs and the `spawn-subagents` skill to point rigid multi-step flows toward prompt templates and direct `subagent` chain/parallel usage instead of `/delegate`

### Patch Changes

- [`0be7b68`](https://github.com/dreki-gg/pi-extensions/commit/0be7b6877e9874b46c756b58c99d599db623ef11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Migrate TypeBox usage and session replacement flows for Pi 0.69 compatibility.

  - switch extension imports from `@sinclair/typebox` to `typebox`
  - update package peer dependencies to require `typebox`
  - move subagent `/run-agent` fork-at follow-up work into `withSession` so post-fork operations use the replacement session safely
  - add command argument completions for `/run-agent`, `/delegate-agents`, `/preset`, `/mode`, and `/plan`
  - align local development dependencies with Pi 0.69 for typechecking and compatibility checks

## 0.6.0

### Minor Changes

- [`5e853af`](https://github.com/dreki-gg/pi-extensions/commit/5e853af054a31c4bf87d80f944513e537a39201d) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Sync the extensions repo with Pi 0.68.0 and improve direct agent runs.

  - `@dreki-gg/pi-context7`: remove stale alias docs and align compatibility tests with the canonical tool names actually exported.
  - `@dreki-gg/pi-modes`: use `before_agent_start.systemPromptOptions.selectedTools` when available so mode prompt text reflects the active prompt tool set.
  - `@dreki-gg/pi-subagent`: add `/run-agent`, support `sessionStrategy: fork-at` in agent frontmatter, default bundled `worker` and `reviewer` to forked direct runs, and add a custom renderer for run summaries.

## 0.5.0

### Minor Changes

- [`4f2f148`](https://github.com/dreki-gg/pi-extensions/commit/4f2f148488e32ff43f97216a5c221fd9d1716a11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - added agents to the registry so my fork is able to discover subagent files

## 0.4.0

### Minor Changes

- [`52d744e`](https://github.com/dreki-gg/pi-extensions/commit/52d744e34f593a7bd6b907d67d5e245ef63b6079) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Improve bundled agent resolution and `/delegate` workflow control in `@dreki-gg/pi-subagent`.

  - Add explicit agent source tracking for bundled, user, and project agents.
  - Resolve agents with layered precedence: bundled → user → project.
  - Add `agentScope` support to delegated execution so workflows can opt into user, project, or both agent layers.
  - Add `/delegate` argument parsing for `--scope`, `--workflow`, and `--yes-project-agents`.
  - Add a confirmation step before running project-local agents from `/delegate` or the `subagent` tool when UI is available.
  - Replace the old `subagent-workflows` skill with `spawn-subagents`, which steers the assistant toward conversational `subagent` usage and keeps `/delegate` as an explicit gated workflow option.

## 0.3.1

### Patch Changes

- [`144498f`](https://github.com/dreki-gg/pi-extensions/commit/144498fd9c23cb5060fb5171e56ff722ebf0c4f2) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Fix two bugs in the `subagent` tool surfaced when spawning long-running reviewer agents:

  - **Bun standalone binary spawn failure**: `getPiInvocation` now detects Bun's virtual filesystem paths (`/$bunfs/...`) in `process.argv[1]` and falls back to invoking the compiled binary directly. Previously, spawned subagents would fail with errors like `/$bunfs/root/pi doesn't exist in this environment` because the virtual path was passed verbatim to `spawn`.
  - **Parallel summary truncation**: `parallel` mode no longer truncates each child agent's final output to 100 characters in the tool result summary. Long reviews from editorial/scout agents are now returned in full so callers don't need to scrape temp files or re-run agents to see their work.

## 0.3.0

### Minor Changes

- [`a114ecc`](https://github.com/dreki-gg/pi-extensions/commit/a114eccd78f4c45501bcbf32e0e202c80f258755) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Merged `@dreki-gg/pi-delegate` into `@dreki-gg/pi-subagent`. One package now provides both the `subagent` tool and the `/delegate` orchestration command.

  ### What's new in `@dreki-gg/pi-subagent`

  - `/delegate` command — synthesize conversation into a task, pick a workflow, execute with scouts/planner/worker/reviewer
  - `/delegate-agents` command — list, customize, or reset bundled agents
  - 6 bundled agents: scout, docs-scout, planner, worker, reviewer, ux-designer
  - `spawn-subagents` skill for conversational subagent orchestration
  - 3 prompt templates: implement, scout-and-plan, implement-and-review

  ### Bundled agent discovery

  Agents are now read directly from the package's `agents/` directory. User overrides in `~/.pi/agent/agents/` still take precedence by name. No file copying on session start.

  Priority order: bundled (lowest) → user → project (highest).

  ### `@dreki-gg/pi-delegate` is deprecated

  All functionality has moved to `@dreki-gg/pi-subagent`. Remove `pi-delegate` and use `pi-subagent` instead:

  ```bash
  pi remove npm:@dreki-gg/pi-delegate
  pi install npm:@dreki-gg/pi-subagent
  ```

## 0.2.0

### Minor Changes

- [#22](https://github.com/dreki-gg/pi-extensions/pull/22) [`d5c55f5`](https://github.com/dreki-gg/pi-extensions/commit/d5c55f533c6e1ec65fcc1cce19537cf91854b122) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Support `thinking` frontmatter field in agent definitions to set reasoning effort level.

  - Read `thinking` from agent `.md` frontmatter and pass `--thinking <level>` to spawned pi processes
  - Update all bundled agents to use OpenAI models with thinking levels
  - Add `ux-designer` agent for frontend UI design with anti-Codex aesthetic guidelines

## 0.1.3

### Patch Changes

- [`0d6fee9`](https://github.com/dreki-gg/pi-extensions/commit/0d6fee9417cbc5874ce5d212b5e6c1f2e42f5192) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Use provider-qualified model IDs in agent frontmatter to work around upstream pi model resolution bug where bare IDs (e.g. `gpt-5.4`) can resolve to the wrong provider (e.g. `azure-openai-responses` instead of `openai`).

## 0.1.2

### Patch Changes

- [`53809f8`](https://github.com/dreki-gg/pi-extensions/commit/53809f83cdf054d1eb58c577903a1d2619a2a654) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add repository.url to package.json for npm provenance verification

## 0.1.1

### Patch Changes

- [`b1e603c`](https://github.com/dreki-gg/pi-extensions/commit/b1e603c9dab1837eed39880c0455b553deab5cb0) Thanks [@jalbarrang](https://github.com/jalbarrang)! - init packages
