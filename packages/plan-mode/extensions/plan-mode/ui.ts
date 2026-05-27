/**
 * Plan mode UI — status bar and step widget rendering.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';

export function updateUI(state: PlanModeState, ctx: ExtensionContext): void {
  const { theme } = ctx.ui;

  if (state.executing && state.plan) {
    const done = state.plan.steps.filter((s) => s.status === 'done').length;
    const total = state.plan.steps.length;
    ctx.ui.setStatus('plan-mode', theme.fg('accent', `📋 exec ${done}/${total}`));
  } else if (state.planEnabled) {
    ctx.ui.setStatus('plan-mode', theme.fg('warning', '📝 plan'));
  } else {
    ctx.ui.setStatus('plan-mode', undefined);
  }

  if (state.executing && state.plan) {
    const lines = state.plan.steps.map((step, i) => {
      const num = `${i + 1}. `;
      switch (step.status) {
        case 'done':
          return theme.fg('success', '✓ ') + theme.fg('muted', theme.strikethrough(num + step.description));
        case 'skipped':
          return theme.fg('warning', '⊘ ') + theme.fg('muted', theme.strikethrough(num + step.description));
        case 'blocked':
          return theme.fg('error', '✗ ') + theme.fg('error', num + step.description);
        default:
          return theme.fg('muted', '☐ ') + (num + step.description);
      }
    });
    ctx.ui.setWidget('plan-todos', lines);
  } else {
    ctx.ui.setWidget('plan-todos', undefined);
  }
}
