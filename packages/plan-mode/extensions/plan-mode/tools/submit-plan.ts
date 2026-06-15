/**
 * submit_plan tool — available during the plan phase.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { Effect } from 'effect';
import { saveHandoff } from '@dreki-gg/taskman';
import { writeTasksJsonl } from '@dreki-gg/taskman';
import { upsertPlanEntry } from '@dreki-gg/taskman';
import { readInitiativesManifest } from '@dreki-gg/taskman';
import { reconcileInitiativeForPlan } from '@dreki-gg/taskman';
import type { RunPlanIO } from '@dreki-gg/taskman';
import { toKebabCase } from '@dreki-gg/taskman';
import { readHeadCommit } from '../git.js';
import type { PlanData, TaskMeta, TaskRecord } from '../types.js';

export interface SubmitPlanCallbacks {
  onPlanSubmitted: (planDir: string, plan: PlanData) => void;
}

export function registerSubmitPlanTool(
  pi: ExtensionAPI,
  runPlanIO: RunPlanIO,
  callbacks: SubmitPlanCallbacks,
): void {
  pi.registerTool({
    name: 'submit_plan',
    label: 'Submit Plan',
    description: 'Finalize a conversational plan with task IDs, JSONL storage, and HANDOFF.md.',
    promptSnippet: 'Finalize the plan with title, handoff, tasks, and dependencies',
    promptGuidelines: [
      'Only call submit_plan after shared understanding has been reached with the user.',
      'Each task needs an id like t-001, a short description, and optional depends_on task IDs.',
      "When a different agent or human will execute the plan, include detailed implementation instructions in each task's details field.",
      "For delegation tasks (those with details), end the details with a verification gate: a concrete command and its expected output, plus any STOP conditions, so a zero-context executor can prove success without judgement.",
      'When you are planning and executing yourself (same session), use lightweight checklist-style tasks: just id + description, omit details. Put the real context in the handoff document instead.',
      'The handoff must be thorough enough that both a human reviewer and executor agent with zero prior context can understand the plan.',
      'For visual/UI work, preview a prototype with preview_prototype during planning — before submit_plan, not as part of it.',
      'For large work split across plans, set `initiative` to the parent initiative (create it first with submit_initiative) and use `depends_on_plans` to order plans against each other — this enables ready-work tracking across sessions and agents.',
    ],
    parameters: Type.Object({
      name: Type.String({
        description: 'Short kebab-case name for the plan (e.g. "add-auth-middleware")',
      }),
      title: Type.String({ description: 'Human-readable plan title' }),
      handoff: Type.String({ description: 'Markdown content for HANDOFF.md' }),
      tasks: Type.Array(
        Type.Object({
          id: Type.String({ description: 'Stable task ID, e.g. t-001' }),
          description: Type.String({
            description: 'Short task label for progress display (≤60 chars)',
          }),
          details: Type.Optional(
            Type.String({
              description:
                'Full implementation instructions for this task. Omit for lightweight checklist-style plans when you are executing yourself.',
            }),
          ),
          depends_on: Type.Optional(Type.Array(Type.String({ description: 'Dependency task ID' }))),
        }),
        { minItems: 1 },
      ),
      initiative: Type.Optional(
        Type.String({
          description:
            'Parent initiative name (kebab) when this plan is one chunk of a larger initiative. Create the initiative first with submit_initiative.',
        }),
      ),
      depends_on_plans: Type.Optional(
        Type.Array(
          Type.String({
            description: 'Names of other plans this plan depends on (cross-initiative allowed).',
          }),
        ),
      ),
    }),

    async execute(_toolCallId, params) {
      const planName = toKebabCase(params.name);
      const planDir = `.plans/${planName}`;
      const initiative = params.initiative ? toKebabCase(params.initiative) : undefined;
      const dependsOnPlans = params.depends_on_plans?.map(toKebabCase);
      const now = new Date().toISOString();
      const baseCommit = await readHeadCommit();
      const meta: TaskMeta = {
        _type: 'meta',
        title: params.title,
        plan_name: planName,
        created_at: now,
        base_commit: baseCommit,
      };
      const tasks: TaskRecord[] = params.tasks.map((task) => ({
        _type: 'task',
        id: task.id,
        description: task.description.slice(0, 60),
        details: task.details ?? '',
        status: 'pending',
        depends_on: task.depends_on,
        created_at: now,
        updated_at: now,
      }));
      const plan: PlanData = {
        title: params.title,
        planName,
        handoff: params.handoff,
        tasks,
        base_commit: baseCommit,
      };

      const unknownInitiative = await runPlanIO(
        Effect.gen(function* () {
          yield* writeTasksJsonl(planDir, meta, tasks);
          yield* saveHandoff(planDir, params.handoff);
          yield* upsertPlanEntry(planName, {
            status: 'in-progress',
            title: params.title,
            initiative,
            depends_on: dependsOnPlans,
          });
          // Keep the parent initiative's projected status in sync.
          yield* reconcileInitiativeForPlan(planName);
          if (!initiative) return false;
          const initiatives = yield* readInitiativesManifest();
          return !initiatives.some((entry) => entry.name === initiative);
        }),
      );

      callbacks.onPlanSubmitted(planDir, plan);

      const linkSuffix = initiative
        ? ` Linked to initiative "${initiative}"${
            unknownInitiative ? ' (no initiatives.jsonl entry yet — create it with submit_initiative)' : ''
          }.`
        : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Plan "${params.title}" saved with ${tasks.length} tasks in ${planDir}. Execute when ready.${linkSuffix}`,
          },
        ],
        details: { planDir, plan, initiative, depends_on_plans: dependsOnPlans },
      };
    },

    renderCall(args, theme) {
      const name = (args as { name?: string }).name ?? 'plan';
      const title = (args as { title?: string }).title ?? '';
      let content = theme.fg('toolTitle', theme.bold('submit_plan '));
      content += theme.fg('accent', name);
      if (title) content += ' ' + theme.fg('dim', `"${title}"`);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const plan = (result.details as { plan?: PlanData } | undefined)?.plan;
      if (!plan) return new Text(theme.fg('success', '✓ Plan saved'), 0, 0);
      const lines = [theme.fg('success', '✓ ') + theme.fg('accent', theme.bold(plan.title)), ''];
      for (const task of plan.tasks)
        lines.push(`  ${theme.fg('muted', task.id)} ${task.description}`);
      return new Text(lines.join('\n'), 0, 0);
    },
  });
}
