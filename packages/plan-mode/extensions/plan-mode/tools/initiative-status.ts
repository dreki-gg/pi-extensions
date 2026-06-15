/**
 * initiative_status tool — read-only snapshot of an initiative.
 *
 * The initiative sibling of plan_status. Shows each member plan with its task
 * progress (resolved/total), lifecycle status, and ready/blocked-by readiness
 * derived from plan-level dependencies. This is the at-a-glance view for
 * splitting an initiative's work across sessions or subagents: "ready" plans
 * have all dependencies satisfied and can be picked up now.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { Effect } from 'effect';
import type { RunPlanIO } from '@dreki-gg/taskman';
import { FileSystem } from '@dreki-gg/taskman';
import { readPlansManifest, type PlanManifestEntry } from '@dreki-gg/taskman';
import { readInitiativesManifest } from '@dreki-gg/taskman';
import { readTasksJsonl } from '@dreki-gg/taskman';
import { initiativeRollup, membersOf, type InitiativeRollup } from '@dreki-gg/taskman';

/** Normalize an initiative hint (`x` or `.plans/x`) to a bare name. */
function normalizeName(hint: string): string {
  return hint
    .replace(/^\.plans\//, '')
    .replace(/\/+$/, '')
    .trim();
}

interface TaskCount {
  resolved: number;
  total: number;
}

/** Load member task counts for a set of plans (resolved = done + skipped). */
function loadTaskCounts(
  plans: readonly PlanManifestEntry[],
): Effect.Effect<Map<string, TaskCount>, never, FileSystem> {
  return Effect.gen(function* () {
    const counts = new Map<string, TaskCount>();
    for (const plan of plans) {
      const snapshot = yield* Effect.orElseSucceed(
        readTasksJsonl(`.plans/${plan.name}`),
        () => undefined,
      );
      const total = snapshot?.tasks.length ?? 0;
      const resolved =
        snapshot?.tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length ?? 0;
      counts.set(plan.name, { resolved, total });
    }
    return counts;
  });
}

const STATUS_GLYPH: Record<string, string> = {
  'in-progress': '○',
  done: '✓',
  superseded: '🔄',
  abandoned: '✗',
};

export function registerInitiativeStatusTool(pi: ExtensionAPI, runPlanIO: RunPlanIO): void {
  pi.registerTool({
    name: 'initiative_status',
    label: 'Initiative Status',
    description:
      'Read-only snapshot of an initiative: member plans with task progress, status, and ready/blocked-by. Use to see what work is unblocked and can be picked up next.',
    promptSnippet: 'Show an initiative: member plans, progress, and ready/blocked work',
    promptGuidelines: [
      'Call initiative_status to see which member plans are ready (dependencies satisfied) before dispatching work across sessions or subagents.',
      'It is read-only and never mutates state.',
    ],
    parameters: Type.Object({
      initiative: Type.Optional(
        Type.String({
          description:
            'Initiative name (or .plans/<name>). Omit to use the sole in-progress initiative.',
        }),
      ),
    }),

    async execute(_toolCallId, params) {
      const hint = params.initiative ? normalizeName(params.initiative) : undefined;

      const snapshot = await runPlanIO(
        Effect.gen(function* () {
          const initiatives = yield* readInitiativesManifest();
          const plans = yield* readPlansManifest();
          return { initiatives, plans };
        }),
      );
      const { initiatives, plans } = snapshot;

      // Resolve the target initiative.
      let targetName = hint;
      if (!targetName) {
        const inProgress = initiatives.filter((entry) => entry.status === 'in-progress');
        if (inProgress.length === 1) targetName = inProgress[0]!.name;
        else {
          // Zero or many: list in-progress initiatives with rollup progress.
          const rows = inProgress.map((entry) => {
            const r = initiativeRollup(entry.name, plans);
            return `  ${r.done}/${r.total} plans  ${entry.name} — ${entry.title} (ready ${r.ready}, blocked ${r.blocked})`;
          });
          const text = inProgress.length
            ? `No single active initiative — ${inProgress.length} in-progress. Pass { initiative: "<name>" }.\n${rows.join('\n')}`
            : 'No in-progress initiative found in .plans/initiatives.jsonl.';
          return {
            content: [{ type: 'text' as const, text }],
            details: {
              active: false,
              in_progress: inProgress.map((e) => e.name),
            } as Record<string, unknown>,
          };
        }
      }

      const entry = initiatives.find((e) => e.name === targetName);
      if (!entry) {
        const names = initiatives.map((e) => e.name).join(', ');
        return {
          content: [
            {
              type: 'text' as const,
              text: `Initiative not found: ${targetName}. Known: ${names || '(none)'}`,
            },
          ],
          details: {
            active: false,
            error: 'not_found',
            initiative: targetName,
          } as Record<string, unknown>,
        };
      }

      const rollup: InitiativeRollup = initiativeRollup(entry.name, plans);
      const taskCounts = await runPlanIO(loadTaskCounts(membersOf(entry.name, plans)));

      const memberLines = rollup.members.map((m) => {
        const glyph = STATUS_GLYPH[m.status] ?? '○';
        const tc = taskCounts.get(m.name);
        const progress = tc && tc.total > 0 ? ` ${tc.resolved}/${tc.total} tasks` : '';
        let readiness = '';
        if (m.status === 'in-progress') {
          readiness = m.ready ? '  [ready]' : `  [blocked by ${m.blockedBy?.join(', ')}]`;
        }
        return `  ${glyph} ${m.name} [${m.status}]${progress}${readiness}`;
      });

      const text =
        `Initiative: ${entry.title} (${entry.name}) — ${entry.status}\n` +
        `Plans: ${rollup.done}/${rollup.total} done — in-progress ${rollup.inProgress} (ready ${rollup.ready}, blocked ${rollup.blocked})` +
        (rollup.closed ? `, closed ${rollup.closed}` : '') +
        '\n' +
        (memberLines.length ? `Member plans:\n${memberLines.join('\n')}` : 'No member plans yet.');

      return {
        content: [{ type: 'text' as const, text }],
        details: {
          active: true,
          initiative: entry.name,
          status: entry.status,
          rollup,
          ready_plans: rollup.members.filter((m) => m.ready).map((m) => m.name),
        } as Record<string, unknown>,
      };
    },

    renderCall(args, theme) {
      const name = (args as { initiative?: string }).initiative;
      let content = theme.fg('toolTitle', theme.bold('initiative_status'));
      if (name) content += ' ' + theme.fg('muted', name);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { active?: boolean; initiative?: string; rollup?: InitiativeRollup }
        | undefined;
      if (!details?.active || !details.rollup)
        return new Text(theme.fg('dim', 'No active initiative'), 0, 0);
      const r = details.rollup;
      return new Text(
        theme.fg('toolTitle', `${details.initiative ?? 'initiative'} `) +
          theme.fg('muted', `${r.done}/${r.total} plans — ready ${r.ready}, blocked ${r.blocked}`),
        0,
        0,
      );
    },
  });
}
