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

  const allResolved =
    state.plan?.tasks.every((t) => t.status === 'done' || t.status === 'skipped' || t.status === 'blocked') ?? false;

  if ((state.executing || state.plan) && state.plan && !allResolved) {
    const lines = state.plan.tasks.map((task) => {
      const label = `${task.id} ${task.description}`;
      switch (task.status) {
        case 'done':
          return theme.fg('success', '✓ ') + theme.fg('muted', theme.strikethrough(label));
        case 'skipped':
          return theme.fg('warning', '⊘ ') + theme.fg('muted', theme.strikethrough(label));
        case 'blocked':
          return theme.fg('error', '✗ ') + theme.fg('error', label);
        default:
          return theme.fg('muted', '☐ ') + label;
      }
    });
    ctx.ui.setWidget('plan-todos', lines);
  } else {
    ctx.ui.setWidget('plan-todos', undefined);
  }
}
