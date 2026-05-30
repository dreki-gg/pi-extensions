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
  PLAN_MODEL,
  PLAN_THINKING,
  EXEC_MODEL,
  EXEC_THINKING,
} from './constants.js';
import type { ThinkingLevel } from './types.js';
import { PlanModeState } from './state.js';
import { loadHandoff, readAndClearExecPending } from './storage/plan-storage.js';
import { readTasksJsonl, writeTasksJsonl } from './storage/task-storage.js';
import { upsertPlanEntry } from './storage/plans-manifest.js';
import { updateUI } from './ui.js';
import { buildPlanModePrompt, buildExecutionPrompt } from './prompts.js';
import { filterExecutionMessages, filterStalePlanMessages } from './context-filter.js';
import { enterPlanMode, exitPlanMode, switchModel } from './phase-transitions.js';
import { resumePlan, executeInNewSession } from './resume.js';
import { registerSubmitPlanTool } from './tools/submit-plan.js';
import { registerPreviewPrototypeTool } from './tools/preview-prototype.js';
import { registerUpdateTaskTool } from './tools/update-task.js';
import { isSafeCommand, isPlanPath } from './utils.js';

export default function planMode(pi: ExtensionAPI): void {
  const state = new PlanModeState();

  // ── Flag ──────────────────────────────────────────────────────────────────
  pi.registerFlag('plan', {
    description: 'Start in plan mode (read-only + medium thinking)',
    type: 'boolean',
    default: false,
  });

  // ── Tools ─────────────────────────────────────────────────────────────────
  registerSubmitPlanTool(pi, {
    onPlanSubmitted: (dir, submittedPlan) => {
      state.planDir = dir;
      state.plan = submittedPlan;
      state.persist(pi);
    },
  });

  registerPreviewPrototypeTool(pi);

  registerUpdateTaskTool(pi, {
    getPlan: () => state.plan,
    onTaskUpdated: async (taskId, status, notes) => {
      if (!state.plan || !state.planDir) return;
      const task = state.plan.tasks.find((candidate) => candidate.id === taskId);
      if (!task) return;
      task.status = status;
      task.updated_at = new Date().toISOString();
      if (notes) task.notes = notes;
      await writeTasksJsonl(
        state.planDir,
        {
          _type: 'meta',
          title: state.plan.title,
          plan_name: state.plan.planName,
          created_at: state.plan.tasks[0]?.created_at ?? task.updated_at,
        },
        state.plan.tasks,
      );
      state.persist(pi);
    },
  });

  // ── Commands ──────────────────────────────────────────────────────────────
  pi.registerCommand('plan', {
    description:
      'Enter plan mode, optionally with a starting prompt. Use "/plan resume" to pick up an existing plan.',
    handler: async (args, ctx) => {
      const trimmed = args?.trim();
      if (trimmed === 'resume') {
        await resumePlan(state, pi, ctx);
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
      await executeInNewSession(ctx, state.planDir, state.plan, kickoff);
    },
  });

  pi.registerCommand('todos', {
    description: 'Show current plan progress',
    handler: async (_args, ctx) => {
      if (!state.plan || state.plan.tasks.length === 0) {
        ctx.ui.notify('No plan yet. Use /plan to start planning.', 'info');
        return;
      }
      const statusIcon = { pending: '○', done: '✓', skipped: '⊘', blocked: '✗' } as const;
      const list = state.plan.tasks
        .map((s) => `${s.id}. ${statusIcon[s.status]} ${s.description}`)
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
        const info = bs.notes
          ? `Task ${bs.id}: ${bs.description}\nReason: ${bs.notes}`
          : `Task ${bs.id}: ${bs.description}`;

        const choice = await ctx.ui.select(`Task blocked — ${info}\n\nWhat next?`, [
          'Skip this task',
          'Provide instructions',
          'Re-plan',
          'Abort execution',
        ]);

        if (choice === 'Skip this task') {
          bs.status = 'skipped';
          bs.updated_at = new Date().toISOString();
          await writeTasksJsonl(
            state.planDir!,
            {
              _type: 'meta',
              title: state.plan.title,
              plan_name: state.plan.planName,
              created_at: state.plan.tasks[0]?.created_at ?? bs.updated_at,
            },
            state.plan.tasks,
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
            await writeTasksJsonl(
              state.planDir!,
              {
                _type: 'meta',
                title: state.plan.title,
                plan_name: state.plan.planName,
                created_at: state.plan.tasks[0]?.created_at ?? bs.updated_at,
              },
              state.plan.tasks,
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

      // Check completion
      const allResolved = state.plan.tasks.every(
        (s) => s.status === 'done' || s.status === 'skipped',
      );
      if (allResolved) {
        if (state.planDir) {
          await upsertPlanEntry(state.plan.planName, { status: 'done', title: state.plan.title });
          await writeTasksJsonl(
            state.planDir,
            {
              _type: 'meta',
              title: state.plan.title,
              plan_name: state.plan.planName,
              created_at: state.plan.tasks[0]?.created_at ?? new Date().toISOString(),
            },
            state.plan.tasks,
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

        const { previousModel: pm, previousThinking: pt } = state;
        state.reset();
        pi.setActiveTools(EXEC_TOOLS);
        if (pm) await switchModel(pi, ctx, pm);
        if (pt) pi.setThinkingLevel(pt);
        updateUI(state, ctx);
        state.persist(pi);
        return;
      }
      return;
    }

    // Plan submitted — user can /plan-exec or type naturally.
    // No menu needed: plan.jsonl + HANDOFF.md are the source of truth.
  });

  // ── Event: session restore ────────────────────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    if (pi.getFlag('plan') === true) state.planEnabled = true;

    state.restore(
      ctx.sessionManager.getEntries() as Array<{ type: string; customType?: string; data?: any }>,
    );

    // Check for exec-pending handoff from planning session
    const pending = await readAndClearExecPending();
    if (pending) {
      state.planDir = pending.planDir;
      {
        const snapshot = await readTasksJsonl(pending.planDir);
        state.plan = snapshot
          ? {
              title: snapshot.meta.title,
              planName: snapshot.meta.plan_name,
              handoff: (await loadHandoff(pending.planDir)) ?? '',
              tasks: snapshot.tasks,
            }
          : undefined;
      }
      if (state.plan) {
        state.executing = true;
        state.planEnabled = false;
        pi.setActiveTools(EXEC_TOOLS);
        await switchModel(pi, ctx, pending.config.model);
        pi.setThinkingLevel(pending.config.thinking as ThinkingLevel);
        updateUI(state, ctx);
        state.persist(pi);
        return;
      }
    }

    // Apply tool restrictions, model, and thinking level
    if (state.planEnabled) {
      pi.setActiveTools(PLAN_TOOLS);
      await switchModel(pi, ctx, PLAN_MODEL);
      pi.setThinkingLevel(PLAN_THINKING);
    } else if (state.executing) {
      pi.setActiveTools(EXEC_TOOLS);
      await switchModel(pi, ctx, EXEC_MODEL);
      pi.setThinkingLevel(EXEC_THINKING);
    }

    updateUI(state, ctx);
  });
}
