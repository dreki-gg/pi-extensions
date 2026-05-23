# @dreki-gg/pi-plan-mode

## 0.6.4

### Patch Changes

- [`1a0857f`](https://github.com/dreki-gg/pi-extensions/commit/1a0857f33c397eb560a94b963913c9aafeca3ec5) Thanks [@jalbarrang](https://github.com/jalbarrang)! - fix(plan-mode): use sendMessage with triggerTurn for Follow up action

  sendUserMessage with deliverAs: 'followUp' only queues the message after the current turn, but inside agent_end there is no active turn — so the message sits in the queue forever. Switch to sendMessage with triggerTurn: true + deliverAs: 'followUp' to correctly queue and force a new turn.

## 0.6.3

### Patch Changes

- [`da2522d`](https://github.com/dreki-gg/pi-extensions/commit/da2522d208461d1bf270cec2de7fa856b72c978e) Thanks [@jalbarrang](https://github.com/jalbarrang)! - fix(plan-mode, ask-mode): replace workspace:\* with actual version during prepack to fix npm install

  The published packages contained `"workspace:*"` in their dependencies field, which npm doesn't understand (`EUNSUPPORTEDPROTOCOL`). The prepack script now rewrites `workspace:*` to the concrete version from command-sandbox's package.json before packing, and postpack restores it via `git checkout`.

## 0.6.2

### Patch Changes

- [`376864c`](https://github.com/dreki-gg/pi-extensions/commit/376864c37cefa47530363b47055311269c1724a8) Thanks [@jalbarrang](https://github.com/jalbarrang)! - fix(plan-mode): queue messages with deliverAs to prevent "agent already processing" errors

  All `sendMessage` and `sendUserMessage` calls inside the `agent_end` handler now use `deliverAs: 'followUp'` so they are queued until the agent fully settles. Previously, "Follow up", "Refine Plan", and "Execute Plan" would fire while the agent was still in a processing state, causing silent failures or the error: "Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message."

## 0.6.1

### Patch Changes

- [`d95dad2`](https://github.com/dreki-gg/pi-extensions/commit/d95dad2ac85c4e5428252ee691152a0db83a0ced) Thanks [@jalbarrang](https://github.com/jalbarrang)! - fix(plan-mode): replace Bun-specific APIs with Node.js `fs/promises`

  `pi` runs under Node.js (`#!/usr/bin/env node`), so `Bun.file()` and `Bun.write()` are unavailable at runtime. Replaced all usages with `readFile` and `writeFile` from `node:fs/promises`, which work in both runtimes.

## 0.6.0

### Minor Changes

- [`2a08c1d`](https://github.com/dreki-gg/pi-extensions/commit/2a08c1d0b10a1ca74dfab74f93dd200570537e0f) Thanks [@jalbarrang](https://github.com/jalbarrang)! - feat(ask-mode, plan-mode): support concatenated shell commands in sandbox validation

  Commands using `&&`, `||`, and `;` operators are now parsed and validated per-segment instead of being blocked outright. Uses `shell-quote` for proper shell tokenization that respects quoted strings, subshells, and redirects.

  Previously, safe commands like `cd src && ls -la` or `git status && git log` were incorrectly blocked because the sandbox only split on pipes (`|`). Now each segment is validated independently against the safe/destructive pattern lists.

  Also adds `cd`, `basename`, `dirname`, `realpath`, `readlink`, and `bun pm ls` to the safe commands list, and blocks command substitution (`$(...)` and backticks) by default.

  Shared sandbox logic extracted to private `@dreki-gg/pi-command-sandbox` package (bundled into published tarballs via `bundledDependencies`).

## 0.5.1

### Patch Changes

- [`8e9aa09`](https://github.com/dreki-gg/pi-extensions/commit/8e9aa0963fe81286e9c5972f6a9d666645807f1a) Thanks [@jalbarrang](https://github.com/jalbarrang)! - fix(plan-mode): allow safe bash commands that were incorrectly blocked in plan mode

  Three fixes to `isSafeCommand`:

  - Allow `mkdir -p .plans/` since the planner needs to create plan directories
  - Fix redirect pattern to not false-positive on stderr redirects like `2>/dev/null`
  - Split piped commands and validate each segment independently, so `curl ... | grep ... | head` works correctly

## 0.5.0

### Minor Changes

- [`32797ff`](https://github.com/dreki-gg/pi-extensions/commit/32797ff18d968e22c6c44e95c46e3393d8928cef) Thanks [@jalbarrang](https://github.com/jalbarrang)! - feat(plan-mode): add Windows compatibility — replace Unix shell commands with cross-platform Bun/Node APIs

  Plan-mode no longer shells out to `cat`, `bash`, or `mkdir` via `pi.exec()`. File I/O now uses `Bun.file()` / `Bun.write()` and `node:fs/promises` `mkdir`, making the extension fully cross-platform. Destructive and safe command pattern lists now include Windows equivalents (`del`, `rd`, `copy`, `move`, `powershell`, `dir`, `where`, `tasklist`, etc.).

  Also fixes Windows compatibility in three other packages:

  - **browser-tools**: `spawn` now uses `shell: true` on Windows so `.cmd` wrappers resolve correctly; `shellEscape` uses double-quote style on Windows; install guidance is platform-aware (Homebrew shown only on macOS).
  - **subagent**: `spawn` uses `shell: true` on Windows when the command is bare `pi`, allowing `pi.cmd` resolution.
  - **lsp**: `globalConfigPath()` now uses `os.homedir()` on Windows instead of the unreliable `process.env.HOME`.

## 0.4.0

### Minor Changes

- [`c86c935`](https://github.com/dreki-gg/pi-extensions/commit/c86c9352150a5bed61602243c8164bdd5d679745) Thanks [@jalbarrang](https://github.com/jalbarrang)! - Add plans.json lifecycle tracking and CLI for cleaning completed plans

  - Extension now writes `.plans/plans.json` to track plan status (`in-progress` / `done`) with timestamps and titles
  - Plans are recorded as `in-progress` when created, marked `done` when all execution steps complete
  - New `pi-plan-mode clean` CLI (`npx @dreki-gg/pi-plan-mode clean [--dry-run]`) removes completed plan directories while preserving in-flight plans
  - Cleanup step added to publish.yml workflow to auto-clean done plans on merge to main
  - Removed stale `docs/plans/` from browser-tools and subagent packages

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
