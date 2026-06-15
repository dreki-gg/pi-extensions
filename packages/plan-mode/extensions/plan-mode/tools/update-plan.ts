/**
 * update_plan tool — plan-level lifecycle control.
 *
 * `update_task` tracks task status; this is its plan-level counterpart
 * (FEEDBACK #2/#3). It lets an agent or user close a plan without a full
 * execution run or hand-editing `.plans/plans.jsonl`:
 *   - done       — completed (work shipped)
 *   - superseded — another plan absorbed the work
 *   - abandoned  — won't do / rejected
 *   - in-progress — reopen
 * `reason` is recorded for honest history (esp. superseded/abandoned).
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { StringEnum } from '@earendil-works/pi-ai';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { PlanStatus } from '../types.js';
import type { RunPlanIO } from '@dreki-gg/taskman';
import { readPlansManifest, upsertPlanEntry } from '@dreki-gg/taskman';
import { reconcileInitiativeForPlan } from '@dreki-gg/taskman';

/** Normalize a plan hint (`my-plan` or `.plans/my-plan`) to a bare name. */
function normalizeName(hint: string): string {
  return hint
    .replace(/^\.plans\//, '')
    .replace(/\/+$/, '')
    .trim();
}

export function registerUpdatePlanTool(pi: ExtensionAPI, runPlanIO: RunPlanIO): void {
  pi.registerTool({
    name: 'update_plan',
    label: 'Update Plan',
    description:
      'Set a plan-level status (done, superseded, abandoned, or reopen to in-progress) with an optional reason. Use to close a plan without a full execution run instead of hand-editing the registry.',
    promptSnippet: 'Close or reopen a plan (done/superseded/abandoned/in-progress) with a reason',
    promptGuidelines: [
      'Use update_plan to close a plan that will not be executed to completion: superseded (another plan shipped it) or abandoned (rejected / won\u2019t do).',
      'Always pass a reason for superseded/abandoned so the registry keeps honest history.',
      'Prefer update_task for per-task progress; update_plan is for the whole plan\u2019s lifecycle.',
    ],
    parameters: Type.Object({
      plan: Type.String({ description: 'Plan name (or .plans/<name>) to update' }),
      status: StringEnum(['in-progress', 'done', 'superseded', 'abandoned'] as const),
      reason: Type.Optional(
        Type.String({ description: 'Why — recorded in the registry (esp. superseded/abandoned)' }),
      ),
    }),

    async execute(_toolCallId, params) {
      const name = normalizeName(params.plan);
      const manifest = await runPlanIO(readPlansManifest());
      const existing = manifest.find((entry) => entry.name === name);
      if (!existing) {
        const names = manifest.map((entry) => entry.name).join(', ');
        const notFound: Record<string, unknown> = { error: 'not_found', plan: name };
        return {
          content: [
            {
              type: 'text' as const,
              text: `Plan not found: ${name}. Known plans: ${names || '(none)'}`,
            },
          ],
          details: notFound,
        };
      }

      await runPlanIO(
        upsertPlanEntry(name, {
          status: params.status as PlanStatus,
          title: existing.title,
          reason: params.reason,
        }),
      );
      // A plan-level status change can flip its parent initiative's projection.
      await runPlanIO(reconcileInitiativeForPlan(name));

      const reasonSuffix = params.reason ? ` — ${params.reason}` : '';
      const okDetails: Record<string, unknown> = {
        plan: name,
        from: existing.status,
        status: params.status,
        reason: params.reason,
      };
      return {
        content: [
          {
            type: 'text' as const,
            text: `Plan ${name}: ${existing.status} → ${params.status}${reasonSuffix}`,
          },
        ],
        details: okDetails,
      };
    },

    renderCall(args, theme) {
      const name = (args as { plan?: string }).plan ?? 'plan';
      const status = (args as { status?: string }).status ?? '';
      let content = theme.fg('toolTitle', theme.bold('update_plan '));
      content += theme.fg('accent', name);
      if (status) content += ' ' + theme.fg('muted', status);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { plan?: string; from?: string; status?: string }
        | undefined;
      if (!details?.status) return new Text(theme.fg('dim', 'Plan updated'), 0, 0);
      const color =
        details.status === 'done'
          ? 'success'
          : details.status === 'in-progress'
            ? 'accent'
            : 'warning';
      return new Text(
        theme.fg('muted', `${details.plan ?? 'plan'} `) +
          theme.fg('dim', `${details.from ?? ''} → `) +
          theme.fg(color, details.status),
        0,
        0,
      );
    },
  });
}
