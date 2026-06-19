/**
 * Resume and execution handoff — pick up in-progress plans, model picker, new session handoff.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';
import type { PlanData } from './types.js';
import type { RunPlanIO } from '@dreki-gg/taskman';

import { readPlansManifest } from '@dreki-gg/taskman';
import { loadHandoff } from '@dreki-gg/taskman';
import { writeExecPending } from './exec-pending.js';
import { readTasksJsonl, writeTasksJsonl } from '@dreki-gg/taskman';
import { enterPlanMode } from './phase-transitions.js';
import { reactivateForExecution } from '@dreki-gg/taskman';

export async function executeInNewSession(
  ctx: ExtensionCommandContext,
  runPlanIO: RunPlanIO,
  dir: string,
  _planData: PlanData,
  kickoff: string,
): Promise<void> {
  // Use the current model for execution — no forced model override.
  const currentModel = ctx.model
    ? { provider: ctx.model.provider, id: ctx.model.id }
    : { provider: 'anthropic', id: 'claude-sonnet-4-20250514' };

  await runPlanIO(writeExecPending(dir, { model: currentModel, thinking: 'low' }));
  const parentSession = ctx.sessionManager.getSessionFile();

  await ctx.newSession({
    parentSession,
    withSession: async (newCtx) => {
      await newCtx.sendUserMessage(kickoff);
    },
  });
}

export async function resumePlan(
  state: PlanModeState,
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  runPlanIO: RunPlanIO,
): Promise<void> {
  const manifest = await runPlanIO(readPlansManifest());
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
  const snapshot = await runPlanIO(readTasksJsonl(dir));

  if (!snapshot) {
    ctx.ui.notify(`Could not load ${dir}/tasks.jsonl`, 'error');
    return;
  }

  state.planDir = dir;
  state.plan = {
    title: snapshot.meta.title,
    planName: snapshot.meta.plan_name,
    handoff: (await runPlanIO(loadHandoff(dir))) ?? '',
    tasks: snapshot.tasks,
    base_commit: snapshot.meta.base_commit,
  };

  const doneCount = state.plan.tasks.filter(
    (task) => task.status === 'done' || task.status === 'skipped',
  ).length;
  const pendingCount = state.plan.tasks.filter((task) => task.status === 'pending').length;
  const blockedCount = state.plan.tasks.filter((task) => task.status === 'blocked').length;
  const deferredCount = state.plan.tasks.filter((task) => task.status === 'deferred').length;

  if (pendingCount === 0 && blockedCount === 0 && deferredCount === 0) {
    ctx.ui.notify(
      `Plan "${state.plan.title}" is already complete (${doneCount}/${state.plan.tasks.length} done).`,
      'info',
    );
    state.plan = undefined;
    state.planDir = undefined;
    return;
  }

  const summary =
    `${doneCount}/${state.plan.tasks.length} done, ${pendingCount} pending` +
    (blockedCount ? `, ${blockedCount} blocked` : '') +
    (deferredCount ? `, ${deferredCount} follow-up` : '');
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

  // Reactivate blocked tasks and discovered follow-ups so "Continue execution"
  // picks them up — this is the moment the user decides to go ahead.
  if (reactivateForExecution(state.plan.tasks, new Date().toISOString())) {
    await runPlanIO(writeTasksJsonl(dir, snapshot.meta, state.plan.tasks));
  }

  const remaining = state.plan.tasks.filter((task) => task.status === 'pending');
  const taskList = remaining.map((task) => `${task.id}. ${task.description}`).join('\n');
  const kickoff = `Resuming plan: "${state.plan.title}"\n\nCompleted: ${doneCount}/${state.plan.tasks.length} tasks\n\nRemaining tasks:\n${taskList}\n\nContinue from ${remaining[0]?.id}. Call update_task after completing each task.`;

  await executeInNewSession(ctx, runPlanIO, dir, state.plan, kickoff);
}
