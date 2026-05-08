# @dreki-gg/pi-plan-mode

## 0.3.1

### Patch Changes

- [`d133c3d`](https://github.com/dreki-gg/pi-extensions/commit/d133c3da917e7e5def568d27d6cde8ae8a6c00d2) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Mark pi peer dependencies as optional so npm does not auto-install pi internals when installing extension packages.

## 0.3.0

### Minor Changes

- [`5c9d134`](https://github.com/dreki-gg/pi-extensions/commit/5c9d134131599cd102f77d3849660e3e6f885f70) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Redesign plan mode as a two-phase workflow with file-based handoff

  - Plan phase uses `claude-opus-4-6:medium` with read-only tools + strict bash allowlist
  - Plans are written to `.plans/<kebab-name>/PLAN.md` with a `START-PROMPT.md` for clean context handoff
  - Execute phase uses `gpt-5.5:low` with full tool access, starting from START-PROMPT.md in a clean context
  - Todo extraction is deferred to execution time (extracted from PLAN.md on "Execute Plan")
  - New menu: Execute Plan, Refine Plan (adversarial self-review), Follow up, Exit plan mode
  - Model and thinking level are saved/restored across phase transitions
  - Removed domain-model, plan-files, and autocomplete sub-workflows

## 0.2.0

### Minor Changes

- [`0be7b68`](https://github.com/dreki-gg/pi-extensions/commit/0be7b6877e9874b46c756b58c99d599db623ef11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add `@dreki-gg/pi-plan-mode`, a Cursor-like planning workflow for pi.

  - add a hard-enforced read-only planning phase with `/plan` and `--plan`
  - prefer `questionnaire` for structured clarification when scope is unclear
  - add `/plan-domain` and `/plan-plans` workflow handoffs, with skill-based execution when `domain-model` and `create-implementation-plans` are available
  - add a controlled plan-file authoring phase plus `/plan-execute` for restoring full tool access and running the approved plan
  - persist extracted plan steps and workflow phase across session resume and tree navigation

### Patch Changes

- [`0be7b68`](https://github.com/dreki-gg/pi-extensions/commit/0be7b6877e9874b46c756b58c99d599db623ef11) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Migrate TypeBox usage and session replacement flows for Pi 0.69 compatibility.

  - switch extension imports from `@sinclair/typebox` to `typebox`
  - update package peer dependencies to require `typebox`
  - move subagent `/run-agent` fork-at follow-up work into `withSession` so post-fork operations use the replacement session safely
  - add command argument completions for `/run-agent`, `/delegate-agents`, `/preset`, `/mode`, and `/plan`
  - align local development dependencies with Pi 0.69 for typechecking and compatibility checks

## 0.1.0

- Initial release.
- Add Cursor-like planning workflow for pi with read-only planning, questionnaire-first clarification, domain-model handoffs, and implementation-plan generation.
