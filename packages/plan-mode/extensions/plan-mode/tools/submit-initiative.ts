/**
 * submit_initiative tool — create an initiative that groups multiple plans.
 *
 * The initiative-level sibling of submit_plan. Use it FIRST for work too large
 * for a single coherent execution session: create the initiative, then submit
 * each executable chunk as its own plan with `initiative` set (and
 * `depends_on_plans` for ordering). The initiative's status is then a
 * projection of its member plans.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { Effect } from 'effect';
import { saveInitiative } from '@dreki-gg/taskman';
import { upsertInitiativeEntry } from '@dreki-gg/taskman';
import type { RunPlanIO } from '@dreki-gg/taskman';
import { toKebabCase } from '@dreki-gg/taskman';

export function registerSubmitInitiativeTool(pi: ExtensionAPI, runPlanIO: RunPlanIO): void {
  pi.registerTool({
    name: 'submit_initiative',
    label: 'Submit Initiative',
    description:
      'Create an initiative that groups multiple plans for a large body of work. Submit member plans separately with their initiative set.',
    promptSnippet: 'Create an initiative to group multiple plans for large work',
    promptGuidelines: [
      'Use submit_initiative when the work does not fit one coherent execution session, or spans multiple subsystems with dependencies between chunks.',
      'Create the initiative first, then submit each executable chunk as its own plan with `initiative` set and `depends_on_plans` capturing ordering.',
      'For a bounded change, skip initiatives and just submit a flat plan.',
    ],
    parameters: Type.Object({
      name: Type.String({
        description: 'Short kebab-case name for the initiative (e.g. "auth-overhaul")',
      }),
      title: Type.String({ description: 'Human-readable initiative title' }),
      overview: Type.String({
        description:
          'Markdown overview for INITIATIVE.md: the goal, the plan breakdown, ordering/dependencies, and how the chunks fit together.',
      }),
    }),

    async execute(_toolCallId, params) {
      const name = toKebabCase(params.name);
      const initiativeDir = `.plans/${name}`;

      await runPlanIO(
        Effect.gen(function* () {
          yield* saveInitiative(initiativeDir, params.overview);
          yield* upsertInitiativeEntry(name, { status: 'in-progress', title: params.title });
        }),
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: `Initiative "${params.title}" created in ${initiativeDir}. Submit member plans with initiative: "${name}".`,
          },
        ],
        details: { initiativeDir, name, title: params.title },
      };
    },

    renderCall(args, theme) {
      const name = (args as { name?: string }).name ?? 'initiative';
      const title = (args as { title?: string }).title ?? '';
      let content = theme.fg('toolTitle', theme.bold('submit_initiative '));
      content += theme.fg('accent', name);
      if (title) content += ' ' + theme.fg('dim', `"${title}"`);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as { name?: string; title?: string } | undefined;
      if (!details?.name) return new Text(theme.fg('success', '✓ Initiative created'), 0, 0);
      return new Text(
        theme.fg('success', '✓ ') +
          theme.fg('accent', theme.bold(details.title ?? details.name)) +
          theme.fg('dim', ` (${details.name})`),
        0,
        0,
      );
    },
  });
}
