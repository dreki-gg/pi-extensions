/**
 * `taskman status` — progress + task ids/statuses for the resolved plan.
 */

import { loadPlanData } from '../../resolve.js';
import type { TaskStatus } from '../../types.js';
import { runPlanIO, resolvePlanDir, CliError } from '../runtime.js';
import { STATUS_GLYPH, emit } from '../format.js';

export async function statusCommand(opts: { plan?: string; json?: boolean }): Promise<void> {
  const { planDir } = await resolvePlanDir(opts.plan);
  const plan = await runPlanIO(loadPlanData(planDir));
  if (!plan) throw new CliError(`No tasks.jsonl found in ${planDir}.`);

  const counts: Record<TaskStatus, number> = {
    done: 0,
    skipped: 0,
    blocked: 0,
    pending: 0,
    deferred: 0,
  };
  for (const task of plan.tasks) counts[task.status] += 1;
  const resolved = counts.done + counts.skipped;

  const parts = [`done ${counts.done}`, `skipped ${counts.skipped}`, `pending ${counts.pending}`];
  if (counts.blocked) parts.push(`blocked ${counts.blocked}`);
  if (counts.deferred) parts.push(`follow-up ${counts.deferred}`);

  const lines = plan.tasks.map(
    (t) => `  ${STATUS_GLYPH[t.status]} ${t.id} [${t.status}] ${t.description}`,
  );
  const human =
    `Plan: ${plan.title} (${plan.planName})\n` +
    `Progress: ${resolved}/${plan.tasks.length} resolved — ${parts.join(', ')}\n` +
    `Tasks:\n${lines.join('\n')}`;

  emit(
    Boolean(opts.json),
    {
      active: true,
      plan_name: plan.planName,
      title: plan.title,
      total: plan.tasks.length,
      counts,
      task_ids: plan.tasks.map((t) => t.id),
    },
    human,
  );
}
