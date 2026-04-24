# @dreki-gg/pi-plan-mode

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
