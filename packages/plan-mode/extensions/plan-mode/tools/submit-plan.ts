/**
 * submit_plan tool — available during the plan phase.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { Effect } from 'effect';
import { saveHandoff } from '../storage/plan-storage.js';
import { writeTasksJsonl } from '../storage/task-storage.js';
import { upsertPlanEntry } from '../storage/plans-manifest.js';
import type { RunPlanIO } from '../effects/runtime.js';
import { toKebabCase } from '../utils.js';
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
      'When you are planning and executing yourself (same session), use lightweight checklist-style tasks: just id + description, omit details. Put the real context in the handoff document instead.',
      'The handoff must be thorough enough that both a human reviewer and executor agent with zero prior context can understand the plan.',
      'For visual/UI work, preview a prototype with preview_prototype during planning — before submit_plan, not as part of it.',
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
    }),

    async execute(_toolCallId, params) {
      const planName = toKebabCase(params.name);
      const planDir = `.plans/${planName}`;
      const now = new Date().toISOString();
      const meta: TaskMeta = {
        _type: 'meta',
        title: params.title,
        plan_name: planName,
        created_at: now,
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
      const plan: PlanData = { title: params.title, planName, handoff: params.handoff, tasks };

      await runPlanIO(
        Effect.gen(function* () {
          yield* writeTasksJsonl(planDir, meta, tasks);
          yield* saveHandoff(planDir, params.handoff);
          yield* upsertPlanEntry(planName, { status: 'in-progress', title: params.title });
        }),
      );

      callbacks.onPlanSubmitted(planDir, plan);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Plan "${params.title}" saved with ${tasks.length} tasks in ${planDir}. Execute when ready.`,
          },
        ],
        details: { planDir, plan },
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
