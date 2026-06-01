/**
 * Phase transitions — enter/exit plan mode, start execution, switch models.
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';
import type { ThinkingLevel } from './types.js';
import type { PlanModeConfig } from './config.js';
import { PLAN_TOOLS, EXEC_TOOLS } from './constants.js';
import { updateUI } from './ui.js';

export async function switchModel(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  preset: { provider: string; id: string },
): Promise<boolean> {
  const model = ctx.modelRegistry.find(preset.provider, preset.id);
  if (!model) {
    ctx.ui.notify(`Model ${preset.provider}/${preset.id} not found`, 'error');
    return false;
  }
  const ok = await pi.setModel(model);
  if (!ok) {
    ctx.ui.notify(`No API key for ${preset.provider}/${preset.id}`, 'error');
    return false;
  }
  return true;
}

export async function enterPlanMode(
  state: PlanModeState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  config: PlanModeConfig,
): Promise<void> {
  state.planEnabled = true;
  state.executing = false;
  state.planDir = undefined;
  state.plan = undefined;
  state.previousThinking = pi.getThinkingLevel() as ThinkingLevel;
  state.previousModel = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
  pi.setActiveTools(PLAN_TOOLS);
  await switchModel(pi, ctx, config.planModel);
  pi.setThinkingLevel(config.planThinking);
  ctx.ui.notify(`Plan mode ON — ${config.planModel.provider}/${config.planModel.id}:${config.planThinking}`, 'info');
  updateUI(state, ctx);
  state.persist(pi);
}

export async function exitPlanMode(
  state: PlanModeState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  const { previousModel, previousThinking } = state;
  state.exitPreservingPlan();
  pi.setActiveTools(EXEC_TOOLS);
  if (previousModel) {
    await switchModel(pi, ctx, previousModel);
  }
  if (previousThinking) {
    pi.setThinkingLevel(previousThinking);
  }
  ctx.ui.notify('Plan mode OFF — original model restored', 'info');
  updateUI(state, ctx);
  state.persist(pi);
}

export async function startExecution(
  state: PlanModeState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  config: PlanModeConfig,
): Promise<void> {
  state.planEnabled = false;
  state.executing = true;
  state.executionStartIdx = ctx.sessionManager.getEntries().length;
  pi.setActiveTools(EXEC_TOOLS);
  await switchModel(pi, ctx, config.execModel);
  pi.setThinkingLevel(config.execThinking);
  ctx.ui.notify(
    `Executing plan — ${config.execModel.provider}/${config.execModel.id}:${config.execThinking}`,
    'info',
  );
  updateUI(state, ctx);
  state.persist(pi);
}
