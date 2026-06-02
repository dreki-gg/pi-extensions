/**
 * plan_status tool — read-only snapshot of the active plan.
 *
 * Lets an agent proactively learn whether a plan is active, its progress, and
 * the valid task ids — instead of discovering that by a failed `update_task`.
 * Resolves disk-backed (attaches the sole in-progress plan), so it works in a
 * fresh execution session. Pure read: never mutates plan state.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { TaskStatus } from '../types.js';
import type { ResolvedPlan } from '../resolve-plan.js';

export interface PlanStatusCallbacks {
  /** Resolve the active plan, attaching from disk when none is in memory. */
  resolvePlan: (opts?: { name?: string }) => Promise<ResolvedPlan>;
}

const STATUS_GLYPH: Record<TaskStatus, string> = {
  done: '✓',
  skipped: '⊘',
  blocked: '✗',
  pending: '○',
  deferred: '+',
};

export function registerPlanStatusTool(pi: ExtensionAPI, callbacks: PlanStatusCallbacks): void {
  pi.registerTool({
    name: 'plan_status',
    label: 'Plan Status',
    description:
      'Read-only snapshot of the active plan: progress counts and every task id + status. Use to check whether a plan is active and what the valid task ids are before calling update_task.',
    promptSnippet: 'Show the active plan: progress + task ids/statuses',
    promptGuidelines: [
      'Call plan_status when unsure whether a plan is active or which task ids exist — it is read-only and never mutates state.',
      'Prefer it over guessing task ids; the returned ids are what update_task expects.',
    ],
    parameters: Type.Object({
      plan: Type.Optional(
        Type.String({
          description:
            'Plan name (or .plans/<name>) to inspect. Only needed to disambiguate when multiple plans are in-progress.',
        }),
      ),
    }),

    async execute(_toolCallId, params) {
      const { plan, candidates } = await callbacks.resolvePlan({ name: params.plan });
      if (!plan) {
        const hint =
          candidates.length > 1
            ? ` In-progress plans: ${candidates.join(', ')} — pass { plan: "<name>" }.`
            : ' No in-progress plan found in .plans/plans.jsonl.';
        const noPlanDetails: Record<string, unknown> = { active: false, candidates };
        return {
          content: [{ type: 'text' as const, text: `No active plan.${hint}` }],
          details: noPlanDetails,
        };
      }

      const counts: Record<TaskStatus, number> = {
        done: 0,
        skipped: 0,
        blocked: 0,
        pending: 0,
        deferred: 0,
      };
      for (const task of plan.tasks) counts[task.status] += 1;
      const resolved = counts.done + counts.skipped;

      const parts = [
        `done ${counts.done}`,
        `skipped ${counts.skipped}`,
        `pending ${counts.pending}`,
      ];
      if (counts.blocked) parts.push(`blocked ${counts.blocked}`);
      if (counts.deferred) parts.push(`follow-up ${counts.deferred}`);

      const lines = plan.tasks.map(
        (task) => `  ${STATUS_GLYPH[task.status]} ${task.id} [${task.status}] ${task.description}`,
      );
      const text =
        `Plan: ${plan.title} (${plan.planName})\n` +
        `Progress: ${resolved}/${plan.tasks.length} resolved — ${parts.join(', ')}\n` +
        `Tasks:\n${lines.join('\n')}`;

      return {
        content: [{ type: 'text' as const, text }],
        details: {
          active: true,
          plan_name: plan.planName,
          title: plan.title,
          total: plan.tasks.length,
          counts,
          task_ids: plan.tasks.map((task) => task.id),
        },
      };
    },

    renderCall(args, theme) {
      const name = (args as { plan?: string }).plan;
      let content = theme.fg('toolTitle', theme.bold('plan_status'));
      if (name) content += ' ' + theme.fg('muted', name);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { active?: boolean; plan_name?: string; total?: number; counts?: Record<string, number> }
        | undefined;
      if (!details?.active) return new Text(theme.fg('dim', 'No active plan'), 0, 0);
      const resolved = (details.counts?.done ?? 0) + (details.counts?.skipped ?? 0);
      return new Text(
        theme.fg('toolTitle', `${details.plan_name ?? 'plan'} `) +
          theme.fg('muted', `${resolved}/${details.total ?? 0} resolved`),
        0,
        0,
      );
    },
  });
}
