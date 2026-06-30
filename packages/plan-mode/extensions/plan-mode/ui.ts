/**
 * Plan mode UI — status bar and task widget rendering.
 *
 * The plan-mode status bar entry is intentionally always cleared: any progress
 * indicator would be derived from in-memory `state.plan`, which drifts from the
 * source of truth on disk. The agent reads real status from `tasks.jsonl` via
 * the `plan_status` tool instead of trusting a memory-rendered badge.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { PlanModeState } from './state.js';

export function updateUI(_state: PlanModeState, ctx: ExtensionContext): void {
  // Never render plan state from memory — clear both the status entry and the
  // (unused) task widget.
  ctx.ui.setStatus('plan-mode', undefined);
  ctx.ui.setWidget('plan-todos', undefined);
}
