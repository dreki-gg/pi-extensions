/**
 * `taskman add-task <description>` — append a deferred follow-up task.
 */

import { appendDeferredTask } from '../../engine.js';
import { runPlanIO, resolvePlanDir, CliError } from '../runtime.js';
import { emit } from '../format.js';

export async function addTaskCommand(
  description: string,
  opts: { plan?: string; reason?: string; details?: string; json?: boolean },
): Promise<void> {
  if (!opts.reason) throw new CliError('--reason is required (why the follow-up matters).');
  const { planName, planDir } = await resolvePlanDir(opts.plan);
  const task = await runPlanIO(
    appendDeferredTask(planDir, {
      description,
      reason: opts.reason,
      details: opts.details,
    }),
  );

  emit(
    Boolean(opts.json),
    { plan_name: planName, task_id: task.id, description: task.description, status: task.status },
    `Captured follow-up ${task.id}: ${task.description} (deferred) in ${planName}.`,
  );
}
