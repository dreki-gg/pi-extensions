/**
 * update_initiative tool — initiative-level lifecycle control.
 *
 * The initiative sibling of update_plan. An initiative's `done` status is a
 * projection of its member plans, but `superseded` / `abandoned` (and reopen)
 * are explicit decisions recorded here with an optional `reason`. A manually
 * set terminal status is never auto-overridden by projection.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { StringEnum } from '@earendil-works/pi-ai';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { InitiativeStatus } from '../types.js';
import type { RunPlanIO } from '@dreki-gg/taskman';
import {
  readInitiativesManifest,
  upsertInitiativeEntry,
} from '@dreki-gg/taskman';

/** Normalize an initiative hint (`x` or `.plans/x`) to a bare name. */
function normalizeName(hint: string): string {
  return hint
    .replace(/^\.plans\//, '')
    .replace(/\/+$/, '')
    .trim();
}

export function registerUpdateInitiativeTool(pi: ExtensionAPI, runPlanIO: RunPlanIO): void {
  pi.registerTool({
    name: 'update_initiative',
    label: 'Update Initiative',
    description:
      'Set an initiative-level status (done, superseded, abandoned, or reopen to in-progress) with an optional reason.',
    promptSnippet: 'Close or reopen an initiative (done/superseded/abandoned/in-progress)',
    promptGuidelines: [
      'Use update_initiative to close an initiative that will not complete via its plans: superseded (another initiative shipped it) or abandoned (won\u2019t do).',
      'Always pass a reason for superseded/abandoned so the registry keeps honest history.',
      'An initiative usually reaches done automatically once every member plan is closed \u2014 prefer letting projection handle it.',
    ],
    parameters: Type.Object({
      initiative: Type.String({ description: 'Initiative name (or .plans/<name>) to update' }),
      status: StringEnum(['in-progress', 'done', 'superseded', 'abandoned'] as const),
      reason: Type.Optional(
        Type.String({ description: 'Why — recorded in the registry (esp. superseded/abandoned)' }),
      ),
    }),

    async execute(_toolCallId, params) {
      const name = normalizeName(params.initiative);
      const manifest = await runPlanIO(readInitiativesManifest());
      const existing = manifest.find((entry) => entry.name === name);
      if (!existing) {
        const names = manifest.map((entry) => entry.name).join(', ');
        return {
          content: [
            {
              type: 'text' as const,
              text: `Initiative not found: ${name}. Known initiatives: ${names || '(none)'}`,
            },
          ],
          details: { error: 'not_found', initiative: name } as Record<string, unknown>,
        };
      }

      await runPlanIO(
        upsertInitiativeEntry(name, {
          status: params.status as InitiativeStatus,
          title: existing.title,
          reason: params.reason,
        }),
      );

      const reasonSuffix = params.reason ? ` — ${params.reason}` : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Initiative ${name}: ${existing.status} → ${params.status}${reasonSuffix}`,
          },
        ],
        details: {
          initiative: name,
          from: existing.status,
          status: params.status,
          reason: params.reason,
        } as Record<string, unknown>,
      };
    },

    renderCall(args, theme) {
      const name = (args as { initiative?: string }).initiative ?? 'initiative';
      const status = (args as { status?: string }).status ?? '';
      let content = theme.fg('toolTitle', theme.bold('update_initiative '));
      content += theme.fg('accent', name);
      if (status) content += ' ' + theme.fg('muted', status);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { initiative?: string; from?: string; status?: string }
        | undefined;
      if (!details?.status) return new Text(theme.fg('dim', 'Initiative updated'), 0, 0);
      const color =
        details.status === 'done'
          ? 'success'
          : details.status === 'in-progress'
            ? 'accent'
            : 'warning';
      return new Text(
        theme.fg('muted', `${details.initiative ?? 'initiative'} `) +
          theme.fg('dim', `${details.from ?? ''} → `) +
          theme.fg(color, details.status),
        0,
        0,
      );
    },
  });
}
