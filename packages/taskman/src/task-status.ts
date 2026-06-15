/**
 * Pure helpers for reasoning about task status at execution checkpoints.
 *
 * `deferred` tasks are discovered follow-ups kept out of the active queue, so
 * they are excluded from "resolved" checks but block plan finalization.
 */

import type { TaskRecord } from './types.js';

export function deferredTasks(tasks: readonly TaskRecord[]): TaskRecord[] {
  return tasks.filter((task) => task.status === 'deferred');
}

/**
 * True when no active work remains — every task is done, skipped, or deferred
 * (nothing pending or blocked).
 */
export function activeTasksResolved(tasks: readonly TaskRecord[]): boolean {
  return tasks.every(
    (task) => task.status === 'done' || task.status === 'skipped' || task.status === 'deferred',
  );
}

/**
 * True when the plan can be marked complete: active work is resolved AND there
 * are no deferred follow-ups awaiting the user's decision.
 */
export function isPlanFinalizable(tasks: readonly TaskRecord[]): boolean {
  return activeTasksResolved(tasks) && !tasks.some((task) => task.status === 'deferred');
}

/**
 * Reactivate tasks for a resumed run: blocked tasks and deferred follow-ups
 * become pending (mutated in place). Returns true if anything changed.
 */
export function reactivateForExecution(tasks: TaskRecord[], timestamp: string): boolean {
  let changed = false;
  for (const task of tasks) {
    if (task.status === 'blocked' || task.status === 'deferred') {
      task.status = 'pending';
      task.updated_at = timestamp;
      changed = true;
    }
  }
  return changed;
}
