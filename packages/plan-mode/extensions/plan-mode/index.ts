/**
 * Plan Mode Extension — Thin orchestrator
 *
 * Two-phase workflow:
 *   1. PLAN phase  — read-only tools + submit_plan tool + medium thinking
 *   2. EXECUTE phase — full tools + update_task tool + low thinking
 *
 * Commands:
 *   /plan [prompt]  — enter plan mode
 *   /plan resume    — resume an in-progress plan from disk
 *   /plan-exec      — execute the current plan in a clean session
 *   /todos          — show current plan progress
 *   Ctrl+Alt+P      — toggle plan mode
 *
 * Flag:
 *   --plan          — start session in plan mode
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Key } from '@earendil-works/pi-tui';
import {
  PLAN_TOOLS,
  EXEC_TOOLS,
} from './constants.js';
import type { TaskStatus } from './types.js';
import { PlanModeState } from './state.js';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { loadHandoff } from '@dreki-gg/taskman';
import { readAndClearExecPending } from './exec-pending.js';
import { readTasksJsonl, writeTasksJsonl } from '@dreki-gg/taskman';
import { upsertPlanEntry, reconcilePlanStatus } from '@dreki-gg/taskman';
import { updateUI } from './ui.js';
import { buildPlanModePrompt, buildExecutionPrompt } from './prompts.js';
import { filterExecutionMessages, filterStalePlanMessages } from './context-filter.js';
import { activeTasksResolved, deferredTasks, isPlanFinalizable } from '@dreki-gg/taskman';
import { enterPlanMode, exitPlanMode, switchModel } from './phase-transitions.js';
import { resumePlan, executeInNewSession } from './resume.js';
import { resolveActivePlan, focusActivePlan } from './resolve-plan.js';
import { reconcileInitiativeForPlan } from '@dreki-gg/taskman';
import { collectPlanDrift } from '@dreki-gg/taskman';
import { registerSubmitPlanTool } from './tools/submit-plan.js';
import { registerSubmitInitiativeTool } from './tools/submit-initiative.js';
import { registerRevisePlanTool } from './tools/revise-plan.js';
import { registerPreviewPrototypeTool } from './tools/preview-prototype.js';
import { registerUpdateTaskTool } from './tools/update-task.js';
import { registerUpdateTasksTool } from './tools/update-tasks.js';
import { registerAddTaskTool } from './tools/add-task.js';
import { registerPlanStatusTool } from './tools/plan-status.js';
import { registerSetActivePlanTool } from './tools/set-active-plan.js';
import { registerUpdatePlanTool } from './tools/update-plan.js';
import { registerUpdateInitiativeTool } from './tools/update-initiative.js';
import { registerInitiativeStatusTool } from './tools/initiative-status.js';
import { registerReconcilePlansTool } from './tools/reconcile-plans.js';
import { isSafeCommand, isPlanPath } from './utils.js';
import { handleListPlans } from './commands/list-plans.js';
import { handleListInitiatives } from './commands/list-initiatives.js';
import { createPlanReferenceIndex } from './references/plan-index.js';
import { registerPlanReferenceAutocomplete } from './references/autocomplete.js';
import { registerPlanReferenceContext } from './references/context.js';

export default function planMode(pi: ExtensionAPI): void {
  const state = new PlanModeState();
  // Build the live Effect runtime once; all storage I/O runs through this bridge.
  const runPlanIO = makePlanRuntime();
  // Cached plan list for `@plan:<slug>` autocomplete; refreshed at session start.
  const planReferenceIndex = createPlanReferenceIndex(runPlanIO);

  // ── Flag ──────────────────────────────────────────────────────────────────
  pi.registerFlag('plan', {
    description: 'Start in plan mode (read-only + medium thinking)',
    type: 'boolean',
    default: false,
  });

  // ── Tools ─────────────────────────────────────────────────────────────────
  registerSubmitPlanTool(pi, runPlanIO, {
    onPlanSubmitted: (dir, submittedPlan) => {
      state.planDir = dir;
      state.plan = submittedPlan;
      state.persist(pi);
    },
  });

  registerRevisePlanTool(pi, runPlanIO, {
    resolvePlan: (opts) => resolveActivePlan(state, pi, runPlanIO, opts),
    onPlanRevised: (dir, revisedPlan) => {
      state.planDir = dir;
      state.plan = revisedPlan;
      state.persist(pi);
    },
  });

  registerSubmitInitiativeTool(pi, runPlanIO);

  registerPreviewPrototypeTool(pi, runPlanIO);

  // Shared task-write closure: mutate the in-memory task, persist tasks.jsonl,
  // and re-derive registry status. Used by both update_task and update_tasks.
  const onTaskUpdated = async (
    taskId: string,
    status: Exclude<TaskStatus, 'pending'>,
    notes?: string,
  ) => {
    if (!state.plan || !state.planDir) return;
    const task = state.plan.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    task.status = status;
    task.updated_at = new Date().toISOString();
    if (notes) task.notes = notes;
    await runPlanIO(
      writeTasksJsonl(
        state.planDir,
        {
          _type: 'meta',
          title: state.plan.title,
          plan_name: state.plan.planName,
          created_at: state.plan.tasks[0]?.created_at ?? task.updated_at,
        },
        state.plan.tasks,
      ),
    );
    // FEEDBACK #1: registry status is a projection of task state. Re-derive it
    // on every task write so completion is decoupled from in-session execution
    // — cross-session / disk-tracked task updates now close the plan too.
    await runPlanIO(
      reconcilePlanStatus(
        state.plan.planName,
        isPlanFinalizable(state.plan.tasks),
        state.plan.title,
      ),
    );
    // Project plan status up to its parent initiative (no-op when standalone).
    await runPlanIO(reconcileInitiativeForPlan(state.plan.planName));
    state.persist(pi);
  };

  registerUpdateTaskTool(pi, {
    resolvePlan: (opts) => resolveActivePlan(state, pi, runPlanIO, opts),
    onTaskUpdated,
  });

  registerUpdateTasksTool(pi, {
    resolvePlan: (opts) => resolveActivePlan(state, pi, runPlanIO, opts),
    // Coalesced batch write: mutate every task in memory first, then perform a
    // SINGLE tasks.jsonl write + ONE registry reconcile. This is the whole point
    // of update_tasks — repeated single-task writes caused file-write contention.
    onTasksUpdated: async (updates) => {
      if (!state.plan || !state.planDir) return;
      const now = new Date().toISOString();
      for (const { taskId, status, notes } of updates) {
        const task = state.plan.tasks.find((candidate) => candidate.id === taskId);
        if (!task) continue;
        task.status = status;
        task.updated_at = now;
        if (notes) task.notes = notes;
      }
      await runPlanIO(
        writeTasksJsonl(
          state.planDir,
          {
            _type: 'meta',
            title: state.plan.title,
            plan_name: state.plan.planName,
            created_at: state.plan.tasks[0]?.created_at ?? now,
          },
          state.plan.tasks,
        ),
      );
      await runPlanIO(
        reconcilePlanStatus(
          state.plan.planName,
          isPlanFinalizable(state.plan.tasks),
          state.plan.title,
        ),
      );
      await runPlanIO(reconcileInitiativeForPlan(state.plan.planName));
      state.persist(pi);
    },
  });

  registerPlanStatusTool(pi, {
    resolvePlan: (opts) => resolveActivePlan(state, pi, runPlanIO, opts),
    listInProgress: async () => {
      const rows = await runPlanIO(collectPlanDrift());
      return rows
        .filter((row) => row.registryStatus === 'in-progress')
        .map((row) => ({
          name: row.name,
          title: row.title ?? row.name,
          resolved: row.resolved ?? 0,
          total: row.total ?? 0,
        }));
    },
  });

  registerSetActivePlanTool(pi, {
    setActivePlan: (name) => focusActivePlan(state, pi, runPlanIO, name),
  });

  registerUpdatePlanTool(pi, runPlanIO);
  registerUpdateInitiativeTool(pi, runPlanIO);
  registerInitiativeStatusTool(pi, runPlanIO);
  registerReconcilePlansTool(pi, runPlanIO);

  // Attach a referenced plan (`@plan:<slug>`) as context when present in a prompt.
  registerPlanReferenceContext(pi, runPlanIO);

  registerAddTaskTool(pi, {
    resolvePlan: (opts) => resolveActivePlan(state, pi, runPlanIO, opts),
    onTaskAdded: async (task) => {
      if (!state.plan || !state.planDir) return;
      state.plan.tasks.push(task);
      await runPlanIO(
        writeTasksJsonl(
          state.planDir,
          {
            _type: 'meta',
            title: state.plan.title,
            plan_name: state.plan.planName,
            created_at: state.plan.tasks[0]?.created_at ?? task.created_at,
          },
          state.plan.tasks,
        ),
      );
      // A new deferred follow-up means the plan is no longer finalizable: re-open
      // it in the registry if it had been auto-marked done.
      await runPlanIO(
        reconcilePlanStatus(
          state.plan.planName,
          isPlanFinalizable(state.plan.tasks),
          state.plan.title,
        ),
      );
      await runPlanIO(reconcileInitiativeForPlan(state.plan.planName));
      state.persist(pi);
    },
  });

  // ── Commands ──────────────────────────────────────────────────────────────
  pi.registerCommand('plan', {
    description:
      'Enter plan mode, optionally with a starting prompt. "/plan resume" picks up an existing plan; "/plan focus <name>" pins the active plan for tracking calls.',
    handler: async (args, ctx) => {
      const trimmed = args?.trim();
      if (trimmed === 'resume') {
        await resumePlan(state, pi, ctx, runPlanIO);
        return;
      }
      // "/plan focus <name>" — pin a plan so update_task / add_task / plan_status
      // default to it without repeating { plan: "<name>" } on every call (#5).
      if (trimmed?.startsWith('focus')) {
        const name = trimmed.slice('focus'.length).trim();
        if (!name) {
          ctx.ui.notify('Usage: /plan focus <name>', 'info');
          return;
        }
        const { plan, candidates } = await focusActivePlan(state, pi, runPlanIO, name);
        if (plan) {
          ctx.ui.notify(`Focused plan: ${plan.title} (${plan.planName})`, 'info');
        } else {
          const hint = candidates.length ? ` In-progress: ${candidates.join(', ')}.` : '';
          ctx.ui.notify(`No plan named "${name}".${hint}`, 'error');
        }
        return;
      }
      if (state.planEnabled || state.executing) {
        await exitPlanMode(state, pi, ctx);
        return;
      }
      await enterPlanMode(state, pi, ctx);
      if (trimmed) pi.sendUserMessage(trimmed);
    },
  });

  pi.registerCommand('plan-exec', {
    description: 'Execute the current plan in a clean session',
    handler: async (_args, ctx) => {
      if (!state.planDir || !state.plan) {
        ctx.ui.notify('No plan to execute.', 'error');
        return;
      }
      const taskList = state.plan.tasks.map((task) => `${task.id}. ${task.description}`).join('\n');
      const first =
        state.plan.tasks.find((task) => task.status === 'pending')?.id ?? state.plan.tasks[0]?.id;
      const kickoff = `Execute the following plan: "${state.plan.title}"\n\nTasks:\n${taskList}\n\nStart with ${first}. Call update_task after completing each task.`;
      await executeInNewSession(ctx, runPlanIO, state.planDir, state.plan, kickoff);
    },
  });

  pi.registerCommand('plans', {
    description:
      'List all plans with filtering and sorting. Usage: /plans [filter] [sort]. Filters: all, in-progress, done, superseded, abandoned. Sorts: newest, oldest, tasks, name.',
    handler: async (args, ctx) => {
      await handleListPlans(ctx, runPlanIO, args);
    },
  });

  pi.registerCommand('initiatives', {
    description:
      'List all initiatives with member-plan rollup. Usage: /initiatives [filter]. Filters: all, in-progress, done, superseded, abandoned.',
    handler: async (args, ctx) => {
      await handleListInitiatives(ctx, runPlanIO, args);
    },
  });

  pi.registerCommand('todos', {
    description: 'Show current plan progress',
    handler: async (_args, ctx) => {
      if (!state.plan || state.plan.tasks.length === 0) {
        ctx.ui.notify('No plan yet. Use /plan to start planning.', 'info');
        return;
      }
      const statusIcon = {
        pending: '○',
        done: '✓',
        skipped: '⊘',
        blocked: '✗',
        deferred: '⏸',
      } as const;
      const list = state.plan.tasks
        .map((s) => {
          const marker = s.origin === 'discovered' ? ' (discovered)' : '';
          return `${s.id}. ${statusIcon[s.status]} ${s.description}${marker}`;
        })
        .join('\n');
      ctx.ui.notify(`Plan Progress:\n${list}`, 'info');
    },
  });

  pi.registerShortcut(Key.ctrlAlt('p'), {
    description: 'Toggle plan mode',
    handler: async (ctx) => {
      if (state.planEnabled || state.executing) {
        await exitPlanMode(state, pi, ctx);
      } else {
        await enterPlanMode(state, pi, ctx);
      }
    },
  });

  // ── Event: block destructive bash + restrict writes in plan mode ──────────
  pi.on('tool_call', async (event) => {
    if (!state.planEnabled) return;

    // Block destructive bash commands
    if (event.toolName === 'bash') {
      const command = event.input.command as string;
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `Plan mode: command blocked. Use /plan to exit plan mode first.\nCommand: ${command}`,
        };
      }
    }

    // Restrict write to .plans/ directory only
    if (event.toolName === 'write' || event.toolName === 'edit') {
      const path = event.input.path as string;
      if (!isPlanPath(path)) {
        return {
          block: true,
          reason: `Plan mode: writes are restricted to .plans/ directory only.\nPath: ${path}`,
        };
      }
    }
  });

  // ── Event: filter context ─────────────────────────────────────────────────
  pi.on('context', async (event) => {
    if (state.planEnabled) return;
    if (state.executing && state.executionStartIdx !== undefined) {
      return { messages: filterExecutionMessages(event.messages, state.executionStartIdx) };
    }
    return { messages: filterStalePlanMessages(event.messages) };
  });

  // ── Event: inject phase prompts ───────────────────────────────────────────
  pi.on('before_agent_start', async () => {
    if (state.planEnabled) {
      return {
        message: {
          customType: 'plan-mode-context',
          content: buildPlanModePrompt(),
          display: false,
        },
      };
    }
    if (state.executing && state.plan) {
      const content = buildExecutionPrompt(state.plan);
      if (content) {
        return {
          message: { customType: 'plan-execution-context', content, display: false },
        };
      }
    }
  });

  // ── Event: agent_end — blocked tasks, completion, post-plan menu ──────────
  pi.on('agent_end', async (_event, ctx) => {
    // ── During execution: handle blocked tasks and completion ──
    if (state.executing && state.plan) {
      const blocked = state.plan.tasks.filter((s) => s.status === 'blocked');

      if (blocked.length > 0) {
        const bs = blocked[0];
        let info = bs.notes
          ? `Task ${bs.id}: ${bs.description}\nReason: ${bs.notes}`
          : `Task ${bs.id}: ${bs.description}`;

        const pausedFollowups = deferredTasks(state.plan.tasks);
        if (pausedFollowups.length > 0) {
          info += `\n\nNote: ${pausedFollowups.length} follow-up(s) captured for later review (/plan resume).`;
        }

        const choice = await ctx.ui.select(`Task blocked — ${info}\n\nWhat next?`, [
          'Skip this task',
          'Provide instructions',
          'Re-plan',
          'Abort execution',
        ]);

        if (choice === 'Skip this task') {
          bs.status = 'skipped';
          bs.updated_at = new Date().toISOString();
          await runPlanIO(
            writeTasksJsonl(
              state.planDir!,
              {
                _type: 'meta',
                title: state.plan.title,
                plan_name: state.plan.planName,
                created_at: state.plan.tasks[0]?.created_at ?? bs.updated_at,
              },
              state.plan.tasks,
            ),
          );
          updateUI(state, ctx);
          state.persist(pi);
          if (state.plan.tasks.some((s) => s.status === 'pending')) {
            pi.sendUserMessage('The blocked task has been skipped. Continue with the next task.', {
              deliverAs: 'followUp',
            });
          }
        } else if (choice === 'Provide instructions') {
          const instructions = await ctx.ui.editor('Instructions for the blocked task:', '');
          if (instructions?.trim()) {
            bs.status = 'pending';
            bs.notes = undefined;
            bs.updated_at = new Date().toISOString();
            await runPlanIO(
              writeTasksJsonl(
                state.planDir!,
                {
                  _type: 'meta',
                  title: state.plan.title,
                  plan_name: state.plan.planName,
                  created_at: state.plan.tasks[0]?.created_at ?? bs.updated_at,
                },
                state.plan.tasks,
              ),
            );
            updateUI(state, ctx);
            state.persist(pi);
            pi.sendUserMessage(
              `Retry task ${bs.id} with these additional instructions: ${instructions.trim()}`,
              { deliverAs: 'followUp' },
            );
          }
          return;
        } else if (choice === 'Re-plan') {
          await enterPlanMode(state, pi, ctx);
          pi.sendUserMessage(
            `Task ${bs.id} was blocked: ${bs.notes ?? 'no details'}. Re-analyze and create a revised plan.`,
            { deliverAs: 'followUp' },
          );
          return;
        } else if (choice === 'Abort execution') {
          await exitPlanMode(state, pi, ctx);
          return;
        }
      }

      // ── Discovered follow-ups checkpoint ──
      // Active work is done but the agent captured deferred follow-ups: keep the
      // plan in-progress and inform the user, who decides via /plan resume.
      const deferred = deferredTasks(state.plan.tasks);
      if (activeTasksResolved(state.plan.tasks) && deferred.length > 0) {
        if (state.planDir) {
          await runPlanIO(
            writeTasksJsonl(
              state.planDir,
              {
                _type: 'meta',
                title: state.plan.title,
                plan_name: state.plan.planName,
                created_at: state.plan.tasks[0]?.created_at ?? new Date().toISOString(),
              },
              state.plan.tasks,
            ),
          );
        }

        const followups = deferred
          .map((s) => {
            const label = `${s.id}. ⏸ ${s.description}`;
            return s.notes ? `${label}\n   ${s.notes}` : label;
          })
          .join('\n');
        const followSummary = [
          `**Plan tasks complete — ${deferred.length} follow-up(s) discovered (kept for later)**`,
          '',
          'Run `/plan resume` to review and decide whether to implement them.',
          '',
          '## Discovered follow-ups',
          '',
          followups,
        ].join('\n');
        pi.sendMessage(
          { customType: 'plan-followups', content: followSummary, display: true },
          { triggerTurn: false },
        );

        const { previousModel: dpm } = state;
        state.exitPreservingPlan();
        pi.setActiveTools(EXEC_TOOLS);
        if (dpm) await switchModel(pi, ctx, dpm);
        updateUI(state, ctx);
        state.persist(pi);
        return;
      }

      // Check completion
      const allResolved = state.plan.tasks.every(
        (s) => s.status === 'done' || s.status === 'skipped',
      );
      if (allResolved) {
        if (state.planDir) {
          await runPlanIO(
            upsertPlanEntry(state.plan.planName, { status: 'done', title: state.plan.title }),
          );
          await runPlanIO(reconcileInitiativeForPlan(state.plan.planName));
          await runPlanIO(
            writeTasksJsonl(
              state.planDir,
              {
                _type: 'meta',
                title: state.plan.title,
                plan_name: state.plan.planName,
                created_at: state.plan.tasks[0]?.created_at ?? new Date().toISOString(),
              },
              state.plan.tasks,
            ),
          );
        }
        const done = state.plan.tasks.filter((s) => s.status === 'done').length;
        const skipped = state.plan.tasks.filter((s) => s.status === 'skipped').length;
        const total = state.plan.tasks.length;
        const stats =
          skipped > 0 ? `${done}/${total} done, ${skipped} skipped` : `${done}/${total} done`;

        // Build a summary of what was actually done from task notes
        const changeSummary = state.plan.tasks
          .map((s) => {
            const icon = s.status === 'done' ? '✓' : '⊘';
            const label = `${s.id}. ${icon} ${s.description}`;
            return s.notes ? `${label}\n   ${s.notes}` : label;
          })
          .join('\n');

        const summary = [
          `**Plan Complete!** ✓ — ${state.plan.title}`,
          '',
          `> ${stats}`,
          '',
          '## Summary',
          '',
          changeSummary,
        ].join('\n');

        pi.sendMessage(
          { customType: 'plan-complete', content: summary, display: true },
          { triggerTurn: false },
        );

        const { previousModel: pm } = state;
        state.reset();
        pi.setActiveTools(EXEC_TOOLS);
        if (pm) await switchModel(pi, ctx, pm);
        updateUI(state, ctx);
        state.persist(pi);
        return;
      }
      return;
    }

    // Auto-exit plan mode after plan/initiative submission so the user
    // returns to normal mode with their original model.
    if (state.planEnabled) {
      await exitPlanMode(state, pi, ctx);
    }
  });

  // ── Event: session restore ────────────────────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    if (pi.getFlag('plan') === true) state.planEnabled = true;

    state.restore(
      ctx.sessionManager.getEntries() as Array<{ type: string; customType?: string; data?: any }>,
    );

    // Register `@plan:<slug>` autocomplete and warm its cache.
    await planReferenceIndex.refresh();
    registerPlanReferenceAutocomplete(ctx, planReferenceIndex);

    // Check for exec-pending handoff from planning session
    const pending = await runPlanIO(readAndClearExecPending());
    if (pending) {
      state.planDir = pending.planDir;
      {
        const snapshot = await runPlanIO(readTasksJsonl(pending.planDir));
        state.plan = snapshot
          ? {
              title: snapshot.meta.title,
              planName: snapshot.meta.plan_name,
              handoff: (await runPlanIO(loadHandoff(pending.planDir))) ?? '',
              tasks: snapshot.tasks,
              base_commit: snapshot.meta.base_commit,
            }
          : undefined;
      }
      if (state.plan) {
        state.executing = true;
        state.planEnabled = false;
        pi.setActiveTools(EXEC_TOOLS);
        await switchModel(pi, ctx, pending.config.model);

        updateUI(state, ctx);
        state.persist(pi);
        return;
      }
    }

    // No plan attached from this session's entries or the exec handoff, but a
    // plan may exist on disk (planning happened in another session). Attach the
    // single in-progress plan so update_task / add_task work without an
    // interactive /plan resume. Data only — does NOT enter execution mode.
    if (!state.plan) {
      await resolveActivePlan(state, pi, runPlanIO);
    }

    // Apply tool restrictions (no model/thinking override — keep user's settings)
    if (state.planEnabled) {
      pi.setActiveTools(PLAN_TOOLS);
    } else if (state.executing) {
      pi.setActiveTools(EXEC_TOOLS);
    }

    updateUI(state, ctx);
  });
}
