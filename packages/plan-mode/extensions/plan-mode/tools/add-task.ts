/**
 * add_task tool — available during execution.
 *
 * Lets the agent capture a follow-up task it discovered while implementing.
 * The task is recorded as a *deferred* `discovered` task so it stays out of the
 * active execution queue — the user reviews and decides via `/plan resume`.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { PlanData, TaskRecord } from '../types.js';
import { nextTaskId } from '../utils.js';

export interface AddTaskCallbacks {
  getPlan: () => PlanData | undefined;
  onTaskAdded: (task: TaskRecord) => void | Promise<void>;
}

export function registerAddTaskTool(pi: ExtensionAPI, callbacks: AddTaskCallbacks): void {
  pi.registerTool({
    name: 'add_task',
    label: 'Add Task',
    description:
      'Capture a follow-up task you discovered while implementing. It is recorded as a deferred task for the user to review later — it is NOT executed in this run.',
    promptSnippet: 'Capture a discovered follow-up as a deferred task for later review',
    promptGuidelines: [
      'Use add_task when you notice worthwhile work outside the current plan while implementing.',
      'Discovered tasks are deferred for the user to review — do NOT implement them now; continue with the planned tasks.',
      'Give a clear reason so the user can decide whether the follow-up is worth doing.',
    ],
    parameters: Type.Object({
      description: Type.String({ description: 'Short task label (≤60 chars)' }),
      reason: Type.String({
        description: 'Why this follow-up matters — what you noticed and why it is worth doing',
      }),
      details: Type.Optional(
        Type.String({ description: 'Optional fuller implementation notes for the follow-up' }),
      ),
      depends_on: Type.Optional(Type.Array(Type.String({ description: 'Dependency task ID' }))),
    }),

    async execute(_toolCallId, params) {
      const plan = callbacks.getPlan();
      if (!plan) throw new Error('No active plan. Cannot add a follow-up task.');

      const now = new Date().toISOString();
      const task: TaskRecord = {
        _type: 'task',
        id: nextTaskId(plan.tasks.map((candidate) => candidate.id)),
        description: params.description.slice(0, 60),
        details: params.details ?? '',
        status: 'deferred',
        origin: 'discovered',
        depends_on: params.depends_on,
        notes: params.reason,
        created_at: now,
        updated_at: now,
      };

      await callbacks.onTaskAdded(task);

      const deferred = plan.tasks.filter((candidate) => candidate.status === 'deferred').length;
      return {
        content: [
          {
            type: 'text' as const,
            text: `Captured follow-up ${task.id}: ${task.description} (deferred for review). ${deferred} follow-up(s) pending. Continue with the planned tasks — do not implement this now.`,
          },
        ],
        details: { task_id: task.id, description: task.description, reason: params.reason },
      };
    },

    renderCall(args, theme) {
      const description = (args as { description?: string }).description ?? '';
      let content = theme.fg('toolTitle', theme.bold('add_task '));
      content += theme.fg('accent', '+ ');
      content += description;
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as { task_id?: string; description?: string } | undefined;
      if (!details) return new Text(theme.fg('dim', 'Follow-up captured'), 0, 0);
      return new Text(
        theme.fg('accent', '+ ') +
          `${theme.fg('muted', details.task_id ?? '')} ${details.description ?? ''} ` +
          theme.fg('dim', '(deferred)'),
        0,
        0,
      );
    },
  });
}
