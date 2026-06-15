/**
 * `taskman reconcile [--apply]` — detect (and optionally repair) status drift.
 */

import { Effect } from 'effect';
import {
  collectPlanDrift,
  collectInitiativeDrift,
  applyReconcile,
  applyInitiativeReconcile,
} from '../../reconcile.js';
import { runPlanIO } from '../runtime.js';
import { emit } from '../format.js';

export async function reconcileCommand(opts: { apply?: boolean; json?: boolean }): Promise<void> {
  const planRows = await runPlanIO(collectPlanDrift());
  const initRows = await runPlanIO(collectInitiativeDrift());

  let repairedPlans: typeof planRows = [];
  let repairedInits: typeof initRows = [];
  if (opts.apply) {
    repairedPlans = await runPlanIO(applyReconcile(planRows).pipe(Effect.orDie));
    repairedInits = await runPlanIO(applyInitiativeReconcile(initRows).pipe(Effect.orDie));
  }

  const planDrift = planRows.filter((r) => r.drift);
  const initDrift = initRows.filter((r) => r.drift);

  const lines: string[] = [];
  if (planDrift.length === 0 && initDrift.length === 0) {
    lines.push('No drift detected.');
  } else {
    for (const r of planDrift) {
      lines.push(
        `  plan ${r.name}: ${r.drift}` +
          (r.drift === 'status'
            ? ` (${r.registryStatus} → ${r.derivedStatus}, ${r.direction})`
            : ''),
      );
    }
    for (const r of initDrift) {
      lines.push(`  initiative ${r.name}: status (${r.registryStatus} → ${r.derivedStatus})`);
    }
  }
  if (opts.apply) {
    lines.push(
      `Applied: ${repairedPlans.length} plan(s), ${repairedInits.length} initiative(s) repaired.`,
    );
  } else if (planDrift.length || initDrift.length) {
    lines.push('Run with --apply to repair safe (upgrade) drift.');
  }

  emit(
    Boolean(opts.json),
    {
      plan_drift: planDrift,
      initiative_drift: initDrift,
      applied: opts.apply
        ? { plans: repairedPlans.map((r) => r.name), initiatives: repairedInits.map((r) => r.name) }
        : null,
    },
    lines.join('\n'),
  );
}
