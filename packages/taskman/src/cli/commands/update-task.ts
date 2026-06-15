/**
 * `taskman update-task <id> <status>` — set a task status + reconcile registry.
 */

import { setTaskStatus } from '../../engine.js';
import type { TaskStatus } from '../../types.js';
import { runPlanIO, resolvePlanDir, CliError } from '../runtime.js';
import { emit } from '../format.js';

const VALID: TaskStatus[] = ['done', 'skipped', 'blocked', 'pending'];

export async function updateTaskCommand(
  taskId: string,
  status: string,
  opts: { plan?: string; notes?: string; json?: boolean },
): Promise<void> {
  if (!VALID.includes(status as TaskStatus)) {
    throw new CliError(`Invalid status "${status}". Use one of: ${VALID.join(', ')}.`);
  }
  const { planName, planDir } = await resolvePlanDir(opts.plan);
  const result = await runPlanIO(setTaskStatus(planDir, taskId, status as TaskStatus, opts.notes));

  emit(
    Boolean(opts.json),
    {
      plan_name: planName,
      task_id: result.task.id,
      status: result.task.status,
      finalizable: result.finalizable,
    },
    `${result.task.id} → ${result.task.status} in ${planName}` +
      (result.finalizable ? ' (plan now finalizable)' : ''),
  );
}
