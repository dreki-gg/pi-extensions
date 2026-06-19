/**
 * Phase transitions — enter/exit plan mode, start execution, switch models.
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';
import {
  PLAN_TOOLS,
  EXEC_TOOLS,
} from './constants.js';
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
): Promise<void> {
  state.planEnabled = true;
  state.executing = false;
  state.planDir = undefined;
  state.plan = undefined;
  state.previousModel = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
  pi.setActiveTools(PLAN_TOOLS);
  ctx.ui.notify('Plan mode ON', 'info');
  updateUI(state, ctx);
  state.persist(pi);
}

export async function exitPlanMode(
  state: PlanModeState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  const { previousModel } = state;
  state.exitPreservingPlan();
  pi.setActiveTools(EXEC_TOOLS);
  if (previousModel) {
    await switchModel(pi, ctx, previousModel);
  }
  ctx.ui.notify('Plan mode OFF', 'info');
  updateUI(state, ctx);
  state.persist(pi);
}

export async function startExecution(
  state: PlanModeState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  state.planEnabled = false;
  state.executing = true;
  state.executionStartIdx = ctx.sessionManager.getEntries().length;
  pi.setActiveTools(EXEC_TOOLS);
  ctx.ui.notify('Executing plan', 'info');
  updateUI(state, ctx);
  state.persist(pi);
}
