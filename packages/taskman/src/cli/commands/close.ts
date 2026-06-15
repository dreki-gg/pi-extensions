/**
 * `taskman close <status>` and `taskman close-initiative <status> [name]`.
 *
 * Sets a plan/initiative lifecycle status directly in the registry. Closing a
 * plan re-projects its parent initiative.
 */

import { Effect } from 'effect';
import { upsertPlanEntry } from '../../storage/plans-manifest.js';
import { upsertInitiativeEntry } from '../../storage/initiatives-manifest.js';
import { reconcileInitiativeForPlan } from '../../initiative.js';
import type { PlanStatus } from '../../types.js';
import { runPlanIO, resolvePlanDir, CliError } from '../runtime.js';
import { emit } from '../format.js';

const VALID: PlanStatus[] = ['done', 'superseded', 'abandoned', 'in-progress'];

function assertStatus(status: string): PlanStatus {
  if (!VALID.includes(status as PlanStatus)) {
    throw new CliError(`Invalid status "${status}". Use one of: ${VALID.join(', ')}.`);
  }
  return status as PlanStatus;
}

export async function closePlanCommand(
  status: string,
  opts: { plan?: string; reason?: string; json?: boolean },
): Promise<void> {
  const s = assertStatus(status);
  const { planName } = await resolvePlanDir(opts.plan);
  await runPlanIO(
    upsertPlanEntry(planName, { status: s, reason: opts.reason }).pipe(
      Effect.andThen(reconcileInitiativeForPlan(planName)),
    ),
  );
  emit(
    Boolean(opts.json),
    { plan_name: planName, status: s, reason: opts.reason ?? null },
    `Plan ${planName} → ${s}${opts.reason ? ` (${opts.reason})` : ''}.`,
  );
}

export async function closeInitiativeCommand(
  status: string,
  name: string,
  opts: { reason?: string; json?: boolean },
): Promise<void> {
  const s = assertStatus(status);
  if (!name) throw new CliError('Initiative name is required.');
  await runPlanIO(upsertInitiativeEntry(name, { status: s, reason: opts.reason }));
  emit(
    Boolean(opts.json),
    { initiative: name, status: s, reason: opts.reason ?? null },
    `Initiative ${name} → ${s}${opts.reason ? ` (${opts.reason})` : ''}.`,
  );
}
