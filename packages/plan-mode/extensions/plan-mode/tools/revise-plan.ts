/**
 * revise_plan tool — sister of submit_plan, available during the plan phase.
 *
 * Re-opens an EXISTING plan by name and rewrites its contents in place. Use
 * when a plan was submitted (often prematurely) and follow-up changes arrive:
 * instead of creating a new plan, revise the existing one.
 *
 * All content fields are optional — only what you pass is overwritten. When
 * `tasks` is supplied it fully defines the new task set (tasks not listed are
 * dropped); for any task whose `id` matches an existing one, its `status`,
 * `notes`, `origin`, and `created_at` are preserved so progress survives a
 * re-plan. Registry status is then re-derived from task state.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { Effect } from 'effect';
import { saveHandoff } from '@dreki-gg/taskman';
import { writeTasksJsonl } from '@dreki-gg/taskman';
import {
  readPlansManifest,
  reconcilePlanStatus,
  upsertPlanEntry,
} from '@dreki-gg/taskman';
import { reconcileInitiativeForPlan, reconcileInitiativeStatus } from '@dreki-gg/taskman';
import { isPlanFinalizable } from '@dreki-gg/taskman';
import { toKebabCase } from '@dreki-gg/taskman';
import type { RunPlanIO } from '@dreki-gg/taskman';
import type { PlanData, TaskMeta, TaskRecord } from '../types.js';

export interface RevisePlanCallbacks {
  resolvePlan: (opts: { name?: string }) => Promise<{ plan?: PlanData; candidates: string[] }>;
  onPlanRevised: (planDir: string, plan: PlanData) => void;
}

export function registerRevisePlanTool(
  pi: ExtensionAPI,
  runPlanIO: RunPlanIO,
  callbacks: RevisePlanCallbacks,
): void {
  pi.registerTool({
    name: 'revise_plan',
    label: 'Revise Plan',
    description:
      'Rewrite an existing plan in place by name — change its title, handoff, and/or tasks. Use after submit_plan when follow-up changes arrive, instead of creating a new plan.',
    promptSnippet: 'Rewrite an existing plan in place (title/handoff/tasks) by name',
    promptGuidelines: [
      'Use revise_plan instead of submit_plan when a plan with the same name already exists and the user asks for follow-up changes.',
      'All content fields are optional — pass only what changes; omitted title/handoff/tasks are left as-is.',
      'When you pass tasks, it fully replaces the task set (tasks you omit are dropped). Status and notes are preserved for any task whose id is unchanged.',
      'Pass initiative / depends_on_plans to (re)link this plan to an initiative or change its plan-level dependencies; omit them to preserve the existing links.',
    ],
    parameters: Type.Object({
      plan: Type.String({ description: 'Plan name (or .plans/<name>) to revise' }),
      title: Type.Optional(Type.String({ description: 'New human-readable plan title' })),
      handoff: Type.Optional(Type.String({ description: 'New markdown content for HANDOFF.md' })),
      tasks: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String({ description: 'Stable task ID, e.g. t-001' }),
            description: Type.String({
              description: 'Short task label for progress display (≤60 chars)',
            }),
            details: Type.Optional(
              Type.String({ description: 'Full implementation instructions for this task.' }),
            ),
            depends_on: Type.Optional(
              Type.Array(Type.String({ description: 'Dependency task ID' })),
            ),
          }),
          { minItems: 1 },
        ),
      ),
      initiative: Type.Optional(
        Type.String({ description: 'Parent initiative name (kebab); omit to preserve.' }),
      ),
      depends_on_plans: Type.Optional(
        Type.Array(
          Type.String({ description: 'Plan names this plan depends on (cross-initiative allowed).' }),
        ),
      ),
    }),

    async execute(_toolCallId, params) {
      const { plan, candidates } = await callbacks.resolvePlan({ name: params.plan });
      if (!plan) {
        const notFound: Record<string, unknown> = {
          error: 'not_found',
          plan: params.plan,
          candidates,
        };
        const hint = candidates.length ? ` In-progress: ${candidates.join(', ')}.` : '';
        return {
          content: [
            { type: 'text' as const, text: `Plan not found: ${params.plan}.${hint}` },
          ],
          details: notFound,
        };
      }

      const now = new Date().toISOString();
      const newTitle = params.title ?? plan.title;
      const newHandoff = params.handoff ?? plan.handoff;

      let tasks = plan.tasks;
      if (params.tasks) {
        const previous = new Map(plan.tasks.map((task) => [task.id, task]));
        tasks = params.tasks.map((task): TaskRecord => {
          const existing = previous.get(task.id);
          return {
            _type: 'task',
            id: task.id,
            description: task.description.slice(0, 60),
            details: task.details ?? '',
            // Preserve progress for tasks whose id is unchanged.
            status: existing?.status ?? 'pending',
            origin: existing?.origin ?? 'plan',
            depends_on: task.depends_on,
            notes: existing?.notes,
            created_at: existing?.created_at ?? now,
            updated_at: now,
          };
        });
      }

      const meta: TaskMeta = {
        _type: 'meta',
        title: newTitle,
        plan_name: plan.planName,
        created_at: plan.tasks[0]?.created_at ?? now,
        base_commit: plan.base_commit,
      };
      const revised: PlanData = {
        title: newTitle,
        planName: plan.planName,
        handoff: newHandoff,
        tasks,
        base_commit: plan.base_commit,
      };
      const planDir = `.plans/${plan.planName}`;

      const newInitiative = params.initiative ? toKebabCase(params.initiative) : undefined;
      const newDependsOn = params.depends_on_plans?.map(toKebabCase);

      await runPlanIO(
        Effect.gen(function* () {
          yield* writeTasksJsonl(planDir, meta, tasks);
          yield* saveHandoff(planDir, newHandoff);
          // Persist a title change without flipping status, then let task state
          // re-derive in-progress ⇄ done (never clobbers superseded/abandoned).
          const manifest = yield* readPlansManifest();
          const current = manifest.find((entry) => entry.name === plan.planName);
          const oldInitiative = current?.initiative;
          yield* upsertPlanEntry(plan.planName, {
            status: current?.status ?? 'in-progress',
            title: newTitle,
            initiative: newInitiative,
            depends_on: newDependsOn,
          });
          yield* reconcilePlanStatus(plan.planName, isPlanFinalizable(tasks), newTitle);
          // Keep both the new and any vacated initiative projections in sync.
          yield* reconcileInitiativeForPlan(plan.planName);
          if (newInitiative && oldInitiative && oldInitiative !== newInitiative) {
            yield* reconcileInitiativeStatus(oldInitiative);
          }
        }),
      );

      callbacks.onPlanRevised(planDir, revised);

      const changed = [
        params.title ? 'title' : undefined,
        params.handoff ? 'handoff' : undefined,
        params.tasks ? 'tasks' : undefined,
      ].filter(Boolean);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Plan "${newTitle}" revised (${changed.join(', ') || 'no changes'}) in ${planDir}.`,
          },
        ],
        details: { planDir, plan: revised, changed },
      };
    },

    renderCall(args, theme) {
      const name = (args as { plan?: string }).plan ?? 'plan';
      let content = theme.fg('toolTitle', theme.bold('revise_plan '));
      content += theme.fg('accent', name);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { plan?: PlanData; changed?: string[] }
        | undefined;
      const plan = details?.plan;
      if (!plan) return new Text(theme.fg('success', '✓ Plan revised'), 0, 0);
      const changed = details?.changed?.length ? ` (${details.changed.join(', ')})` : '';
      const lines = [
        theme.fg('success', '✓ ') +
          theme.fg('accent', theme.bold(plan.title)) +
          theme.fg('dim', changed),
        '',
      ];
      for (const task of plan.tasks)
        lines.push(`  ${theme.fg('muted', task.id)} ${task.description}`);
      return new Text(lines.join('\n'), 0, 0);
    },
  });
}
