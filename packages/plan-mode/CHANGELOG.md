# @dreki-gg/pi-plan-mode

## 0.26.2

### Patch Changes

- Updated dependencies
  - @dreki-gg/taskman@0.3.0

## 0.26.1

### Patch Changes

- Internal refactor: the task-management engine (storage, schema, reconcile,
  initiative projection, task-status, plan resolution) now lives in the new
  `@dreki-gg/taskman` package, which plan-mode depends on. No behavior change —
  the same tools, commands, and `.plans/` layout, with the engine shared so other
  harnesses can drive the same ledger via the `taskman` CLI.
- Updated dependencies
  - @dreki-gg/taskman@0.2.0

## 0.26.0

### Minor Changes

- Make plans more executable by zero-context executors. Plans now stamp the git
  commit they were written against (`base_commit`), and the execution prompt runs
  a drift check — if HEAD has moved, the executor is told to diff, re-read the
  affected files, and proceed with caution. Planning guidance also now asks
  delegation tasks to end their details with a verification gate (a concrete
  command + expected output) and STOP conditions, so success is machine-checkable.
  Fully backward-compatible: older plans without `base_commit` simply skip the
  drift check.

## 0.25.0

### Minor Changes

- Add `@plan:<slug>` plan references with autocomplete. Type `@plan:` in any message to fuzzy-search and tag a plan (all plans listed, in-progress first), and on send the referenced plan's tasks + handoff are attached as context so the agent understands the reference. Resolution is context-only — it never switches execution mode, tools, or model — and follows first-wins when multiple tokens are present.

## 0.24.1

### Patch Changes

- Fix lost-update race on the plan/initiative registries and stop reconcile from regressing finished plans.

  - **Serialized registry writes:** concurrent tool calls in one block (e.g. several `submit_initiative` / `submit_plan` / `revise_plan` at once) previously ran an unguarded read-modify-write against `plans.jsonl` / `initiatives.jsonl`, so only the last write survived. A process-wide per-file lock (`withFileLock`) now serializes the read→modify→write of both registries and per-plan `tasks.jsonl`, eliminating the lost updates. Atomic writes already guarded against torn files; this closes the in-process concurrency gap.
  - **No wrong-direction reconcile:** `reconcile_plans --apply` now only records completion (`in-progress → done`) and never auto-downgrades a `done` plan back to `in-progress`. A done plan with incomplete tasks (work merged but tasks never marked done) is surfaced as `needs-tasks-done` for a human to resolve by marking the tasks done, instead of being silently regressed.

## 0.24.0

### Minor Changes

- Add an **initiatives** layer above plans for decomposing large work (beads-style grouping + cross-plan dependencies).

  - New `submit_initiative`, `update_initiative`, and `initiative_status` tools, plus a `/initiatives` command.
  - `submit_plan` / `revise_plan` gain optional `initiative` and `depends_on_plans` (plan-level dependencies; cross-initiative allowed).
  - An initiative's status is a projection of its member plans (mirroring how a plan's status projects from its tasks); `done` is derived automatically while `superseded` / `abandoned` stay explicit.
  - `initiative_status` computes ready-work — which member plans are unblocked (all dependencies `done`) vs blocked-by — so work can be split across sessions or subagents.
  - `reconcile_plans` now also detects/repairs initiative-level status drift; the `clean` CLI archives closed initiatives alongside closed plans.
  - New `.plans/initiatives.jsonl` registry and `.plans/<initiative>/INITIATIVE.md` overview. All new fields are optional — existing flat plans are unaffected.

## 0.23.0

### Minor Changes

- `preview_prototype` is now freeform. The tool dropped its Pug dependency and the imposed wrapper template (fixed dark theme, badge header, purple-accent panel) that made every prototype look the same. It now takes a `html` parameter — a complete, self-contained HTML document the agent authors with full freedom over markup, fonts, colors, layout, and inline scripts — and only persists and opens it. A bare fragment is tolerated and wrapped in a minimal unstyled shell. The `visual-prototype` skill and plan-mode prompt now steer the agent toward product-fitting designs and toward delegating the markup to the `ux-designer` subagent for real design taste, instead of generic boilerplate.

## 0.22.0

### Minor Changes

- Add `/plans` command to list, filter, and sort plans interactively. Supports filtering by status (in-progress, done, superseded, abandoned) and sorting by date, task count, or name. Works both interactively and with inline args (e.g. `/plans done oldest`).

## 0.21.0

### Minor Changes

- Add two plan-management tools:

  - `revise_plan` — sister of `submit_plan` that rewrites an existing plan in place by name. All content fields (title, handoff, tasks) are optional, so you pass only what changes. When tasks are supplied they fully replace the set, but `status` and `notes` are preserved for any task whose id is unchanged; registry status is re-derived from task state. Use when a plan was submitted prematurely and follow-up changes arrive, instead of creating a new plan.
  - `set_active_plan` — tool form of the `/plan focus` command. Pins a plan into session state so subsequent `plan_status` / `update_task` / `add_task` calls target it. Useful when `plan_status` reports multiple in-progress plans and the agent needs to select one programmatically. Available in both plan and execution phases.

## 0.20.1

### Patch Changes

- Hide the `technical-options` skill from model auto-invocation (`disable-model-invocation: true`). It carried always-on system-prompt token cost but never auto-triggered in practice. It remains available on demand via `/skill:technical-options`. `planning-context` and `visual-prototype` are unchanged.

## 0.20.0

### Minor Changes

- 37d0f37: Add `update_tasks` batch tool: mark several plan tasks done/skipped in a single
  call with one coalesced `tasks.jsonl` write (avoids the file-write contention
  from repeated `update_task` calls). Each item is `{ task_id, status, notes? }`;
  blocking stays single-task via `update_task`.

## 0.19.0

### Minor Changes

- 48cee24: fix(plan-mode): multi-plan / cross-session drift + silent wrong-plan writes

  Real-world report from a repo with many simultaneously-in-progress plans surfaced two trust-breakers plus several rough edges (see `FEEDBACK.md`). All addressed:

  - **Registry status is now a projection of task state** (🔴 #1). Plan completion was coupled to a formal in-session execution run (`state.executing`), so a plan driven to all-tasks-`done` via `update_task` in another session/model stayed `in-progress` forever. `reconcilePlanStatus` now re-derives `plans.jsonl` status from `tasks.jsonl` on every task write (in `update_task` **and** `add_task`), decoupling completion from execution mode.
  - **Explicit `plan` hint always wins** (🔴 #7). `resolveActivePlan` returned the in-memory `state.plan` before ever consulting an explicit `{ plan: "<name>" }` argument, so once a plan was submitted in a session every `update_task` / `add_task` silently pinned to it — landing writes in the wrong `tasks.jsonl`. The hint is now resolved **before** the in-memory short-circuit and re-attaches the named plan from disk.
  - **New `update_plan` tool** (#2/#3): close or reopen a plan (`done` / `superseded` / `abandoned` / `in-progress`) with a `reason`, instead of hand-editing the registry or smuggling status into the title.
  - **Widened plan status** (#3): `PlanManifestEntry.status` gains `superseded` and `abandoned`, plus an optional `reason`. Only `in-progress` is active; terminal statuses drop out of resolution and are never auto-overridden by reconciliation.
  - **New `reconcile_plans` tool** (#6): walks every plan, reports drift (registry vs. derived task status), orphan task dirs, and registry-only plans; `apply: true` repairs safe `in-progress` ⇄ `done` drift.
  - **`clean` archives instead of deletes** (#4): closed-plan directories move to `.plans/.archive/<name>/` by default (preserving HANDOFF.md + tasks.jsonl); true deletion is gated behind `--purge`. The CLI now reads `plans.jsonl` (was `plans.json`).
  - **Multi-plan UX** (#5): `/plan focus <name>` pins the active plan so tracking calls default to it; `plan_status` with no arg and multiple in-progress plans renders a progress table (`7/17`, `8/8 ⚠ done?`) that surfaces reconcile candidates at a glance.

## 0.18.0

### Minor Changes

- Make `update_task` / `add_task` usable across sessions and resilient for autonomous agents.

  The active plan was session-scoped: `update_task` / `add_task` only worked when a plan was submitted in the same session, restored from its entries, or handed off via the one-shot exec-pending marker. An agent executing an existing `.plans/<name>/` in a fresh session (the common plan-here / execute-there flow) hit a hard `No active plan` throw.

  - **Disk-backed resolution** (`resolveActivePlan`): when nothing is attached in memory, the active plan is resolved from `.plans/plans.jsonl` — the sole in-progress plan auto-attaches (data only; does NOT enter execution mode / change tools / model). Wired into `session_start` and both tracking tools.
  - **No hard throws on tracking calls**: `update_task` / `add_task` now return soft, non-terminating results (no active plan, unknown task id, already-resolved task) so a tracking miss never derails the real work. `update_task` is idempotent — re-marking the same status is a no-op success.
  - **`plan` parameter**: both tools accept an optional `plan` (name or `.plans/<name>`) to disambiguate without the interactive `/plan resume` when multiple plans are in-progress.
  - **`update_task` corrections**: a different status on an already-resolved task now applies as a correction (e.g. `done`→`skipped`, or `blocked`→`done` to unblock) and is reported as such, instead of being refused.
  - **New `plan_status` tool**: read-only snapshot of the active plan — progress counts + every task id/status — so an agent can check what's active and which ids are valid (disk-backed; works in a fresh execution session) instead of probing with a failing `update_task`. Added to both tool sets.

## 0.17.1

### Patch Changes

- submit_plan no longer terminates the agent turn. After a plan is saved the agent can continue in the same turn (e.g. summarize or proceed) instead of cutting off.

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
