/**
 * reconcile_plans tool — detect & repair drift between tasks and registry.
 *
 * Walks every plan, compares the registry `status` against the status derived
 * from `tasks.jsonl`, and reports the diff (FEEDBACK #6). With `apply: true` it
 * repairs the safe `in-progress` ⇄ `done` projection; orphans and
 * registry-only plans are surfaced for a human decision but never auto-changed.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { RunPlanIO } from '@dreki-gg/taskman';
import {
  applyInitiativeReconcile,
  applyReconcile,
  collectInitiativeDrift,
  collectPlanDrift,
  type InitiativeDriftRow,
  type PlanDriftRow,
} from '@dreki-gg/taskman';

function describeRow(row: PlanDriftRow): string {
  const progress = row.hasTasks ? ` (${row.resolved}/${row.total})` : '';
  if (row.drift === 'registry-only') {
    return `  ⚠ ${row.name} — registry ${row.registryStatus}, no tasks.jsonl (un-trackable)`;
  }
  if (row.drift === 'orphan') {
    return `  ⚠ ${row.name}${progress} — tasks.jsonl with no registry entry (orphan)`;
  }
  if (row.drift === 'status') {
    if (row.direction === 'downgrade') {
      // Wrong-direction projection: do NOT auto-repair. Mark tasks done instead.
      return `  ⚠ ${row.name}${progress} — registry ${row.registryStatus}, tasks say ${row.derivedStatus} (likely merged; mark tasks done — not auto-repaired)`;
    }
    return `  ✗ ${row.name}${progress} — registry ${row.registryStatus}, tasks say ${row.derivedStatus}`;
  }
  return `  ✓ ${row.name}${progress} — ${row.registryStatus} (in sync)`;
}

export function registerReconcilePlansTool(pi: ExtensionAPI, runPlanIO: RunPlanIO): void {
  pi.registerTool({
    name: 'reconcile_plans',
    label: 'Reconcile Plans',
    description:
      'Walk every plan and report where the registry status disagrees with task state (drift), plus orphan task dirs and registry-only plans. Pass apply:true to repair safe in-progress↔done drift.',
    promptSnippet: 'Detect/repair drift between tasks.jsonl and the plan registry',
    promptGuidelines: [
      'Use reconcile_plans to audit .plans/ when registry status looks stale (e.g. a fully-done plan still in-progress).',
      'Run it read-only first; pass apply:true once you have reviewed the reported drift.',
      'apply:true only records completion (in-progress→done). It never regresses a done plan back to in-progress — if a done plan shows incomplete tasks (work merged but tasks not marked), mark those tasks done instead.',
    ],
    parameters: Type.Object({
      apply: Type.Optional(
        Type.Boolean({
          description: 'Repair status-drift by projecting derived task status into the registry.',
        }),
      ),
    }),

    async execute(_toolCallId, params) {
      const rows = await runPlanIO(collectPlanDrift());
      const initiativeRows = await runPlanIO(collectInitiativeDrift());
      const drifted = rows.filter((row) => row.drift);
      const initiativeDrifted = initiativeRows.filter((row) => row.drift);

      let repaired: PlanDriftRow[] = [];
      let initiativeRepaired: InitiativeDriftRow[] = [];
      if (params.apply) {
        repaired = await runPlanIO(applyReconcile(rows));
        // Re-collect after plan repairs so initiative projection sees fresh state.
        initiativeRepaired = await runPlanIO(
          applyInitiativeReconcile(await runPlanIO(collectInitiativeDrift())),
        );
      }

      const lines = rows.map(describeRow);
      const initiativeLines = initiativeRows.map(
        (row) =>
          row.drift === 'status'
            ? `  ✗ ${row.name} (initiative, ${row.members} plans) — registry ${row.registryStatus}, plans say ${row.derivedStatus}`
            : `  ✓ ${row.name} (initiative, ${row.members} plans) — ${row.registryStatus} (in sync)`,
      );
      const statusDrift = drifted.filter(
        (r) => r.drift === 'status' && r.direction === 'upgrade',
      ).length;
      const downgrades = drifted.filter(
        (r) => r.drift === 'status' && r.direction === 'downgrade',
      ).length;
      const orphans = drifted.filter((r) => r.drift === 'orphan').length;
      const registryOnly = drifted.filter((r) => r.drift === 'registry-only').length;

      const totalDrift = drifted.length + initiativeDrifted.length;
      const header = params.apply
        ? `Reconciled ${repaired.length} plan(s) + ${initiativeRepaired.length} initiative(s).`
        : totalDrift === 0
          ? 'All plans and initiatives in sync.'
          : `${totalDrift} drift issue(s) found (run with apply:true to repair status drift).`;

      const summary = [
        `status-drift ${statusDrift}`,
        `needs-tasks-done ${downgrades}`,
        `orphan ${orphans}`,
        `registry-only ${registryOnly}`,
      ].join(', ');

      const initiativeBlock = initiativeLines.length
        ? `\nInitiatives:\n${initiativeLines.join('\n')}`
        : '';
      const text = `${header}\n${summary}\n${lines.join('\n')}${initiativeBlock}`;
      return {
        content: [{ type: 'text' as const, text }],
        details: {
          applied: Boolean(params.apply),
          repaired: repaired.map((r) => r.name),
          drift: drifted.map((r) => ({ name: r.name, kind: r.drift, direction: r.direction })),
          total: rows.length,
          initiative_repaired: initiativeRepaired.map((r) => r.name),
          initiative_drift: initiativeDrifted.map((r) => ({ name: r.name, kind: r.drift })),
          initiative_total: initiativeRows.length,
        },
      };
    },

    renderCall(args, theme) {
      const apply = (args as { apply?: boolean }).apply;
      let content = theme.fg('toolTitle', theme.bold('reconcile_plans'));
      if (apply) content += ' ' + theme.fg('warning', 'apply');
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { applied?: boolean; repaired?: string[]; drift?: unknown[]; total?: number }
        | undefined;
      if (!details) return new Text(theme.fg('dim', 'Reconciled'), 0, 0);
      const driftCount = details.drift?.length ?? 0;
      if (details.applied) {
        return new Text(
          theme.fg('success', `✓ repaired ${details.repaired?.length ?? 0}`) +
            theme.fg('muted', ` / ${details.total ?? 0} plans`),
          0,
          0,
        );
      }
      return new Text(
        driftCount === 0
          ? theme.fg('success', `✓ ${details.total ?? 0} plans in sync`)
          : theme.fg('warning', `${driftCount} drift`) +
              theme.fg('muted', ` / ${details.total ?? 0} plans`),
        0,
        0,
      );
    },
  });
}
