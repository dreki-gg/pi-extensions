/**
 * Resume and execution handoff — pick up in-progress plans, model picker, new session handoff.
 */

import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';
import type { PlanData } from './types.js';
import { EXEC_THINKING, EXEC_MODEL_OPTIONS } from './constants.js';
import { readPlansJson } from './plans-json.js';
import { loadPlanFromDisk, writeExecPending, savePlanToDisk } from './plan-storage.js';
import { enterPlanMode } from './phase-transitions.js';

export async function pickExecutionModel(
  ctx: ExtensionContext,
): Promise<{ provider: string; id: string } | undefined> {
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

export async function resumePlan(
  state: PlanModeState,
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const manifest = await readPlansJson();
  const inProgress = Object.entries(manifest).filter(([, e]) => e.status === 'in-progress');

  if (inProgress.length === 0) {
    ctx.ui.notify('No in-progress plans found in .plans/plans.json', 'info');
    return;
  }

  const options = inProgress.map(([name, entry]) => `${name} — ${entry.title}`);
  options.push('Cancel');

  const choice = await ctx.ui.select('Resume which plan?', options);
  if (!choice || choice === 'Cancel') return;

  const planName = choice.split(' — ')[0];
  const dir = `.plans/${planName}`;
  const loaded = await loadPlanFromDisk(dir);

  if (!loaded) {
    ctx.ui.notify(`Could not load ${dir}/plan.json`, 'error');
    return;
  }

  state.planDir = dir;
  state.plan = loaded;

  const doneCount = state.plan.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const pendingCount = state.plan.steps.filter((s) => s.status === 'pending').length;
  const blockedCount = state.plan.steps.filter((s) => s.status === 'blocked').length;

  if (pendingCount === 0 && blockedCount === 0) {
    ctx.ui.notify(`Plan "${state.plan.title}" is already complete (${doneCount}/${state.plan.steps.length} done).`, 'info');
    state.plan = undefined;
    state.planDir = undefined;
    return;
  }

  const summary = `${doneCount}/${state.plan.steps.length} done, ${pendingCount} pending${blockedCount ? `, ${blockedCount} blocked` : ''}`;
  const action = await ctx.ui.select(
    `Resume "${state.plan.title}" (${summary}) — what next?`,
    ['Continue execution', 'Re-plan from scratch', 'Cancel'],
  );

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
      `There is an existing plan "${planTitle}" at ${planDirPath}/plan.json. Review it and create a revised plan using submit_plan. Keep the same plan name ("${planName}").`,
    );
    return;
  }

  // Unblock any blocked steps
  if (blockedCount > 0) {
    for (const step of state.plan.steps) {
      if (step.status === 'blocked') step.status = 'pending';
    }
    await savePlanToDisk(dir, state.plan);
  }

  const remaining = state.plan.steps
    .map((s, i) => ({ ...s, num: i + 1 }))
    .filter((s) => s.status === 'pending');
  const stepList = remaining.map((s) => `${s.num}. ${s.description}`).join('\n');
  const kickoff = `Resuming plan: "${state.plan.title}"\n\nCompleted: ${doneCount}/${state.plan.steps.length} steps\n\nRemaining steps:\n${stepList}\n\nContinue from step ${remaining[0].num}. Call update_step after completing each step.`;

  await executeInNewSession(ctx, dir, state.plan, kickoff);
}
