/**
 * Plan mode UI — status bar and task widget rendering.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';

export function updateUI(state: PlanModeState, ctx: ExtensionContext): void {
  const { theme } = ctx.ui;

  if (state.executing && state.plan) {
    const done = state.plan.tasks.filter((task) => task.status === 'done').length;
    const total = state.plan.tasks.length;
    ctx.ui.setStatus('plan-mode', theme.fg('accent', `📋 exec ${done}/${total}`));
  } else if (state.plan && !state.planEnabled) {
    const done = state.plan.tasks.filter((task) => task.status === 'done').length;
    const total = state.plan.tasks.length;
    ctx.ui.setStatus('plan-mode', theme.fg('muted', `📋 ${done}/${total}`));
  } else if (state.planEnabled) {
    ctx.ui.setStatus('plan-mode', theme.fg('warning', '📝 plan'));
  } else {
    ctx.ui.setStatus('plan-mode', undefined);
  }

  // Task list lives in plan.jsonl — no widget needed.
  ctx.ui.setWidget('plan-todos', undefined);
}
