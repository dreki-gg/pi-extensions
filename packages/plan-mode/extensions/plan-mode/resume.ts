/**
 * Resume and execution handoff — pick up in-progress plans, model picker, new session handoff.
 */

import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';
import type { PlanData } from './types.js';
import { EXEC_THINKING, EXEC_MODEL_OPTIONS } from './constants.js';
import { readPlansManifest } from './storage/plans-manifest.js';
import { loadHandoff, writeExecPending } from './storage/plan-storage.js';
import { readTasksJsonl, writeTasksJsonl } from './storage/task-storage.js';
import { enterPlanMode } from './phase-transitions.js';

export async function pickExecutionModel(ctx: ExtensionContext): Promise<{ provider: string; id: string } | undefined> {
  const labels = EXEC_MODEL_OPTIONS.map((o) => o.label);
  const choice = await ctx.ui.select('Execute with:', labels);
  if (!choice) return undefined;
  return EXEC_MODEL_OPTIONS.find((o) => o.label === choice)?.model;
}

export async function executeInNewSession(
  ctx: ExtensionCommandContext,
  dir: string,
  _planData: PlanData,
  kickoff: string,
): Promise<void> {
  const selectedModel = await pickExecutionModel(ctx);
  if (!selectedModel) return;

  await writeExecPending(dir, { model: selectedModel, thinking: EXEC_THINKING });
  const parentSession = ctx.sessionManager.getSessionFile();

  await ctx.newSession({
    parentSession,
    withSession: async (newCtx) => {
      await newCtx.sendUserMessage(kickoff);
    },
  });
}

export async function resumePlan(state: PlanModeState, pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  const manifest = await readPlansManifest();
  const inProgress = manifest.filter((entry) => entry.status === 'in-progress');

  if (inProgress.length === 0) {
    ctx.ui.notify('No in-progress plans found in .plans/plans.jsonl', 'info');
    return;
  }

  const options = inProgress.map((entry) => `${entry.name} — ${entry.title}`);
  options.push('Cancel');

  const choice = await ctx.ui.select('Resume which plan?', options);
  if (!choice || choice === 'Cancel') return;

  const planName = choice.split(' — ')[0];
  const dir = `.plans/${planName}`;
  const snapshot = await readTasksJsonl(dir);

  if (!snapshot) {
    ctx.ui.notify(`Could not load ${dir}/tasks.jsonl`, 'error');
    return;
  }

  state.planDir = dir;
  state.plan = {
    title: snapshot.meta.title,
    planName: snapshot.meta.plan_name,
    handoff: (await loadHandoff(dir)) ?? '',
    tasks: snapshot.tasks,
  };

  const doneCount = state.plan.tasks.filter((task) => task.status === 'done' || task.status === 'skipped').length;
  const pendingCount = state.plan.tasks.filter((task) => task.status === 'pending').length;
  const blockedCount = state.plan.tasks.filter((task) => task.status === 'blocked').length;

  if (pendingCount === 0 && blockedCount === 0) {
    ctx.ui.notify(`Plan "${state.plan.title}" is already complete (${doneCount}/${state.plan.tasks.length} done).`, 'info');
    state.plan = undefined;
    state.planDir = undefined;
    return;
  }

  const summary = `${doneCount}/${state.plan.tasks.length} done, ${pendingCount} pending${blockedCount ? `, ${blockedCount} blocked` : ''}`;
  const action = await ctx.ui.select(`Resume "${state.plan.title}" (${summary}) — what next?`, [
    'Continue execution',
    'Re-plan from scratch',
    'Cancel',
  ]);

  if (!action || action === 'Cancel') {
    state.plan = undefined;
    state.planDir = undefined;
    return;
  }

  if (action === 'Re-plan from scratch') {
    const planTitle = state.plan.title;
    const planDirPath = state.planDir;
    await enterPlanMode(state, pi, ctx);
    pi.sendUserMessage(
      `There is an existing plan "${planTitle}" at ${planDirPath}/tasks.jsonl. Review it and create a revised plan using submit_plan. Keep the same plan name ("${planName}").`,
    );
    return;
  }

  if (blockedCount > 0) {
    for (const task of state.plan.tasks) {
      if (task.status === 'blocked') {
        task.status = 'pending';
        task.updated_at = new Date().toISOString();
      }
    }
    await writeTasksJsonl(dir, snapshot.meta, state.plan.tasks);
  }

  const remaining = state.plan.tasks.filter((task) => task.status === 'pending');
  const taskList = remaining.map((task) => `${task.id}. ${task.description}`).join('\n');
  const kickoff = `Resuming plan: "${state.plan.title}"\n\nCompleted: ${doneCount}/${state.plan.tasks.length} tasks\n\nRemaining tasks:\n${taskList}\n\nContinue from ${remaining[0]?.id}. Call update_task after completing each task.`;

  await executeInNewSession(ctx, dir, state.plan, kickoff);
}
