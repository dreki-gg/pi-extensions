/**
 * Plan Mode Extension — Thin orchestrator
 *
 * Two-phase workflow:
 *   1. PLAN phase  — read-only tools + submit_plan tool + medium thinking
 *   2. EXECUTE phase — full tools + update_step tool + low thinking
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
import { PLAN_TOOLS, EXEC_TOOLS, PLAN_MODEL, PLAN_THINKING, EXEC_MODEL, EXEC_THINKING } from './constants.js';
import type { ThinkingLevel } from './types.js';
import { PlanModeState } from './state.js';
import { savePlanToDisk, loadPlanFromDisk, readAndClearExecPending, updatePlansManifest } from './plan-storage.js';
import { updateUI } from './ui.js';
import { buildPlanModePrompt, buildExecutionPrompt } from './prompts.js';
import { filterExecutionMessages, filterStalePlanMessages } from './context-filter.js';
import { enterPlanMode, exitPlanMode, switchModel } from './phase-transitions.js';
import { resumePlan, executeInNewSession } from './resume.js';
import { registerSubmitPlanTool } from './tools/submit-plan.js';
import { registerUpdateStepTool } from './tools/update-step.js';
import { isSafeCommand } from './utils.js';

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

  registerUpdateStepTool(pi, {
    getPlan: () => state.plan,
    onStepUpdated: (step, status, notes) => {
      if (!state.plan) return;
      state.plan.steps[step - 1].status = status;
      if (notes) state.plan.steps[step - 1].notes = notes;
      state.persist(pi);
    },
  });

  // ── Commands ──────────────────────────────────────────────────────────────
  pi.registerCommand('plan', {
    description: 'Enter plan mode, optionally with a starting prompt. Use "/plan resume" to pick up an existing plan.',
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
      const stepList = state.plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n');
      const kickoff = `Execute the following plan: "${state.plan.title}"\n\nSteps:\n${stepList}\n\nStart with step 1. Call update_step after completing each step.`;
      await executeInNewSession(ctx, state.planDir, state.plan, kickoff);
    },
  });

  pi.registerCommand('todos', {
    description: 'Show current plan progress',
    handler: async (_args, ctx) => {
      if (!state.plan || state.plan.steps.length === 0) {
        ctx.ui.notify('No plan yet. Use /plan to start planning.', 'info');
        return;
      }
      const statusIcon = { pending: '○', done: '✓', skipped: '⊘', blocked: '✗' } as const;
      const list = state.plan.steps
        .map((s, i) => `${i + 1}. ${statusIcon[s.status]} ${s.description}`)
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

  // ── Event: block destructive bash in plan mode ────────────────────────────
  pi.on('tool_call', async (event) => {
    if (!state.planEnabled) return;
    if (event.toolName === 'bash') {
      const command = event.input.command as string;
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `Plan mode: command blocked. Use /plan to exit plan mode first.\nCommand: ${command}`,
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
        message: { customType: 'plan-mode-context', content: buildPlanModePrompt(), display: false },
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

  // ── Event: agent_end — blocked steps, completion, post-plan menu ──────────
  pi.on('agent_end', async (_event, ctx) => {
    // ── During execution: handle blocked steps and completion ──
    if (state.executing && state.plan) {
      const blocked = state.plan.steps
        .map((s, i) => ({ ...s, num: i + 1 }))
        .filter((s) => s.status === 'blocked');

      if (blocked.length > 0) {
        const bs = blocked[0];
        const info = bs.notes
          ? `Step ${bs.num}: ${bs.description}\nReason: ${bs.notes}`
          : `Step ${bs.num}: ${bs.description}`;

        const choice = await ctx.ui.select(`Step blocked — ${info}\n\nWhat next?`, [
          'Skip this step', 'Provide instructions', 'Re-plan', 'Abort execution',
        ]);

        if (choice === 'Skip this step') {
          state.plan.steps[bs.num - 1].status = 'skipped';
          await savePlanToDisk(state.planDir!, state.plan);
          updateUI(state, ctx);
          state.persist(pi);
          if (state.plan.steps.some((s) => s.status === 'pending')) {
            pi.sendUserMessage('The blocked step has been skipped. Continue with the next step.', { deliverAs: 'followUp' });
          }
        } else if (choice === 'Provide instructions') {
          const instructions = await ctx.ui.editor('Instructions for the blocked step:', '');
          if (instructions?.trim()) {
            state.plan.steps[bs.num - 1].status = 'pending';
            state.plan.steps[bs.num - 1].notes = undefined;
            await savePlanToDisk(state.planDir!, state.plan);
            updateUI(state, ctx);
            state.persist(pi);
            pi.sendUserMessage(
              `Retry step ${bs.num} with these additional instructions: ${instructions.trim()}`,
              { deliverAs: 'followUp' },
            );
          }
          return;
        } else if (choice === 'Re-plan') {
          await enterPlanMode(state, pi, ctx);
          pi.sendUserMessage(
            `Step ${bs.num} was blocked: ${bs.notes ?? 'no details'}. Re-analyze and create a revised plan.`,
            { deliverAs: 'followUp' },
          );
          return;
        } else if (choice === 'Abort execution') {
          await exitPlanMode(state, pi, ctx);
          return;
        }
      }

      // Check completion
      const allResolved = state.plan.steps.every((s) => s.status === 'done' || s.status === 'skipped');
      if (allResolved) {
        if (state.planDir) {
          await updatePlansManifest(state.planDir.replace(/^\.plans\//, ''), 'done', state.plan.title);
          await savePlanToDisk(state.planDir, state.plan);
        }
        const done = state.plan.steps.filter((s) => s.status === 'done').length;
        const skipped = state.plan.steps.filter((s) => s.status === 'skipped').length;
        const total = state.plan.steps.length;
        const stats = skipped > 0
          ? `${done}/${total} done, ${skipped} skipped`
          : `${done}/${total} done`;

        // Build a summary of what was actually done from step notes
        const changeSummary = state.plan.steps
          .map((s, i) => {
            const icon = s.status === 'done' ? '✓' : '⊘';
            const label = `${i + 1}. ${icon} ${s.description}`;
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

    // ── After plan submission: show post-plan menu ──
    if (!state.planEnabled || !ctx.hasUI) return;
    if (!state.planDir || !state.plan) return;

    const choice = await ctx.ui.select('Plan ready — what next?', [
      'Execute Plan', 'Refine Plan', 'Follow up', 'Exit plan mode',
    ]);

    if (choice === 'Execute Plan') {
      pi.sendUserMessage('/plan-exec', { deliverAs: 'followUp' });
    } else if (choice === 'Refine Plan') {
      pi.sendUserMessage(
        `Review the plan you just created with an adversarial lens. Challenge assumptions, find gaps, identify risks, and look for:

- Missing edge cases or error handling
- Incorrect assumptions about the codebase
- Steps that are too vague or could be misinterpreted
- Missing dependencies between steps
- Simpler alternatives that were overlooked

After your review, call submit_plan again with the improved plan.`,
        { deliverAs: 'followUp' },
      );
    } else if (choice === 'Follow up') {
      // No-op: dismiss menu, let user type naturally
    } else if (choice === 'Exit plan mode') {
      await exitPlanMode(state, pi, ctx);
    }
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
      state.plan = await loadPlanFromDisk(pending.planDir);
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
