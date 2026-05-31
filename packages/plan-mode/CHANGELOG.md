# @dreki-gg/pi-plan-mode

## 0.17.0

### Minor Changes

- Refactor storage/domain layer to Effect (tagged errors, Schema-based JSONL validation, a FileSystem service + runtime layer) and add beads-style discovered follow-up tasks.

  During execution the agent can now call `add_task` to capture worthwhile out-of-plan work as a `deferred` follow-up (with a reason), without implementing it. Discovered follow-ups are surfaced at checkpoints (blocked pause and when planned work finishes), keep the plan in-progress, and are picked up when you choose "Continue execution" via `/plan resume`.

## 0.16.0

### Minor Changes

- 5c70b28: Reframe plan-mode HTML as a planning-phase visual aid instead of a finalization receipt.

  - `submit_plan` no longer generates `plan.html`. It writes only `tasks.jsonl`, `HANDOFF.md`, and the manifest entry. The previous HTML duplicated the handoff and task list (already tracked elsewhere) and was never opened.
  - Added a `preview_prototype` tool, available during planning. It renders self-contained Pug to a standalone HTML visual aid under `.plans/_prototypes/`, opens it, and notifies the path — so the user can react to a UI/component/style design _before_ the plan hardens.
  - Added a bundled `visual-prototype` skill that routes UI/component/layout/style planning work to `preview_prototype` before `submit_plan`.
  - Added a bundled `planning-context` skill that drives the living `context.md` deliberation discipline (intent, decisions, constraints, open questions, discarded options).

## 0.15.1

### Patch Changes

- Fix execution stopping after the final task is marked done. `update_task` no longer terminates the turn merely because the task queue is empty, so the agent can run its closing summary / validation pass before the `agent_end` completion handler takes over. The `blocked` branch still terminates to pause for user input.

## 0.15.0

### Minor Changes

- Restrict write/edit tools to .plans/ directory only during plan phase. Add isPlanPath utility. Update prompt to document --help/man support and write restrictions.

### Patch Changes

- Updated dependencies []:
  - @dreki-gg/pi-command-sandbox@0.3.0

## 0.14.5

### Patch Changes

- Proper markdown rendering in plan.html — fenced code blocks, inline code, bold, italic, links, and all heading levels.

## 0.14.4

### Patch Changes

- Remove task list widget entirely — plan.jsonl is the source of truth.

## 0.14.3

### Patch Changes

- Only show task widget during active plan execution, not after exiting plan mode.

## 0.14.2

### Patch Changes

- Remove post-plan submission menu and auto-hide task widget when all tasks are resolved.

## 0.14.1

### Patch Changes

- Fix update_task failing after exiting plan mode; make task details optional for lightweight checklist-style plans.

  - exitPlanMode now preserves plan data so update_task works outside execution mode
  - submit_plan accepts tasks without details for self-execution workflows
  - Plan widget shows in tracking mode after exiting plan mode
  - Prompt guidance distinguishes delegation vs self-execution plan weights

## 0.14.0

### Minor Changes

- Refactor plan-mode to conversational planning with JSONL task storage and HTML output. Replace steps with task records, add atomic writes, Pug-based plan.html generation, and migrate manifest to JSONL. Update subagent prompts.

## 0.13.0

### Minor Changes

- Replace context+risks with HANDOFF.md and step summaries. submit_plan now writes a HANDOFF.md alongside plan.json. Completion message shows an actual summary of changes from step notes instead of just a checklist. Executor is prompted to always include notes summarizing what was done.

## 0.12.1

### Patch Changes

- Include `skills/` directory in package files so the bundled technical-options skill is published.

## 0.12.0

### Minor Changes

- Bundle `technical-options` skill inside the package (installable via `pi.skills`). The planner prompt now explicitly tells the agent to generate proposals itself and only delegate voting to subagents, keeping the planner visible as the main agent.

## 0.11.0

### Minor Changes

- Integrate technical-options skill into plan mode: add `subagent` to plan-phase tools and nudge the planner to use structured proposal evaluation when facing significant design decisions with multiple viable approaches.

## 0.10.1

### Patch Changes

- Fix "Execute Plan" menu option crashing with "Agent is already processing" error. The `sendUserMessage('/plan-exec')` call inside the `agent_end` handler was missing `deliverAs: 'followUp'`. Added regression test that scans all `sendUserMessage` calls inside `agent_end` handlers to ensure they always include `deliverAs`.

## 0.10.0

### Minor Changes

- Refactor: extract plan-mode god module into domain-driven modules. index.ts goes from ~780 to ~308 lines.

  New files:

  - `constants.ts` — tool sets, model presets, thinking levels, model picker options
  - `state.ts` — PlanModeState class encapsulating all mutable state with persist/restore
  - `plan-storage.ts` — disk I/O: save/load plans, exec-pending markers, manifest updates
  - `ui.ts` — status bar and step widget rendering
  - `prompts.ts` — plan phase and execution phase prompt builders
  - `context-filter.ts` — message filtering for context event
  - `phase-transitions.ts` — enter/exit plan mode, start execution, model switching
  - `resume.ts` — resume flow, model picker, new session handoff

  No functional changes — pure structural refactor.

## 0.9.2

### Patch Changes

- Fix plan completion not triggering immediately: update_step now returns `terminate: true` when all steps are resolved, so the agent stops and agent_end fires right away with the completion message.

## 0.9.1

### Patch Changes

- Simplify execution model picker to just two preset options: gpt-5.5 and claude-opus-4-6. No more nested registry browsing.

## 0.9.0

### Minor Changes

- Plan execution now launches in a clean session via `ctx.newSession()` for true context isolation. The executor gets a fresh context window with zero planning history, no skill references, and no system prompt pollution — fixing the root cause of rogue executor behavior.

  New features:

  - Model picker before execution: choose Default, Previous, or any model from registry
  - `/plan-exec` command for direct execution handoff
  - Removed `search_skills` from execution tools (executor follows the plan, not skills)

  Breaking: Execution always creates a new session. The planning session is preserved and linked via parentSession.

## 0.8.1

### Patch Changes

- Strengthen execution context injection to prevent the agent from going rogue. The prompt now explicitly forbids running diagnostics/skills/linters unless a step asks for it, highlights the current step front and center, and demands immediate update_step calls.

## 0.8.0

### Minor Changes

- Add `/plan resume` command to pick up in-progress plans from disk. Shows a list of in-progress plans from `.plans/plans.json`, lets the user select one, and resumes execution from where it left off. Also supports re-planning from scratch.

## 0.7.4

### Patch Changes

- Simplify "Follow up" menu option: just dismiss the menu and let the user type naturally instead of opening an editor. The planner remains active with submit_plan available.

## 0.7.3

### Patch Changes

- Fix "Follow up" menu option to wrap user message with planner context, instructing the agent to revise and resubmit the plan via submit_plan.

## 0.7.2

### Patch Changes

- Drop planning conversation from executor context to prevent context window overflow when switching to a model with a smaller context window.

## 0.7.1

### Patch Changes

- Replace bundled workspace dependency on @dreki-gg/pi-command-sandbox with a normal registry dependency. Removes prepack/postpack scripts and bundledDependencies.

- Updated dependencies []:
  - @dreki-gg/pi-command-sandbox@0.2.0

## 0.7.0

### Minor Changes

- Replace file-based plan handoff (PLAN.md + START-PROMPT.md) with structured tools:
  - `submit_plan` tool: planner submits structured plan data (title, context, steps, risks) → writes `.plans/<name>/plan.json`
  - `update_step` tool: executor marks steps as done/skipped/blocked with optional notes
  - Blocked steps pause execution and prompt user for action (skip, provide instructions, re-plan, abort)
  - Plan completion when all steps are done or skipped
  - Removed regex-based `[DONE:n]` scanning and markdown parsing

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
