/**
 * update_task tool — available during execution and after exiting plan mode with a submitted plan.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { StringEnum } from '@earendil-works/pi-ai';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { PlanData, TaskStatus } from '../types.js';

export interface UpdateTaskCallbacks {
  getPlan: () => PlanData | undefined;
  onTaskUpdated: (
    taskId: string,
    status: Exclude<TaskStatus, 'pending'>,
    notes?: string,
  ) => void | Promise<void>;
}

export function registerUpdateTaskTool(pi: ExtensionAPI, callbacks: UpdateTaskCallbacks): void {
  pi.registerTool({
    name: 'update_task',
    label: 'Update Task',
    description:
      'Mark a plan task as done, skipped, or blocked. If blocked, execution pauses for user intervention.',
    promptSnippet: 'Mark a plan task as done, skipped, or blocked',
    promptGuidelines: [
      'Call update_task after completing each plan task before moving to the next.',
      'Always include notes summarizing what was done, why skipped, or why blocked.',
      'Use update_task with status "blocked" and explain the reason in notes if a task cannot be completed.',
    ],
    parameters: Type.Object({
      task_id: Type.String({ description: 'Task ID (for example, t-001)' }),
      status: StringEnum(['done', 'skipped', 'blocked'] as const),
      notes: Type.Optional(
        Type.String({ description: 'What was done, why skipped, or why blocked' }),
      ),
    }),

    async execute(_toolCallId, params) {
      const plan = callbacks.getPlan();
      if (!plan) throw new Error('No active plan. Cannot update task.');

      const task = plan.tasks.find((candidate) => candidate.id === params.task_id);
      if (!task) throw new Error(`Task not found: ${params.task_id}`);
      if (task.status !== 'pending') {
        throw new Error(
          `Task ${params.task_id} is already "${task.status}". Only pending tasks can be updated.`,
        );
      }

      await callbacks.onTaskUpdated(params.task_id, params.status, params.notes);

      const details = {
        task_id: params.task_id,
        status: params.status,
        notes: params.notes,
        description: task.description,
      };
      if (params.status === 'blocked') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Task ${params.task_id} blocked. Execution paused — waiting for user input.`,
            },
          ],
          details,
          terminate: true,
        };
      }

      const done = plan.tasks.filter((candidate) => candidate.status === 'done').length;
      const skipped = plan.tasks.filter((candidate) => candidate.status === 'skipped').length;
      const resolved = done + skipped;
      const next = plan.tasks.find((candidate) => candidate.status === 'pending');
      const statusEmoji = params.status === 'done' ? '✓' : '⊘';
      let text = `${statusEmoji} Task ${params.task_id} ${params.status}. Progress: ${resolved}/${plan.tasks.length}`;
      if (params.notes) text += ` — ${params.notes}`;
      text += next ? `\n\nNext task ${next.id}: ${next.description}` : '\n\nAll tasks resolved!';

      // Do not terminate the turn just because the queue is empty: that would cut off
      // the agent's final pass (closing summary, validation, follow-up) after the last
      // task is marked done. Completion is handled out-of-band by the `agent_end`
      // handler in index.ts. Only the `blocked` branch above terminates, to pause for
      // user input.
      return { content: [{ type: 'text' as const, text }], details };
    },

    renderCall(args, theme) {
      const taskId = (args as { task_id?: string }).task_id ?? '?';
      const status = (args as { status?: string }).status ?? '';
      let content = theme.fg('toolTitle', theme.bold('update_task '));
      content += theme.fg('muted', taskId);
      if (status)
        content +=
          ' ' +
          theme.fg(
            status === 'done' ? 'success' : status === 'skipped' ? 'warning' : 'error',
            status,
          );
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { task_id?: string; status?: string; description?: string }
        | undefined;
      if (!details) return new Text(theme.fg('dim', 'Updated'), 0, 0);
      const statusMap: Record<string, string> = {
        done: theme.fg('success', '✓'),
        skipped: theme.fg('warning', '⊘'),
        blocked: theme.fg('error', '✗'),
      };
      return new Text(
        `${statusMap[details.status ?? ''] ?? ''} Task ${details.task_id}: ${details.description ?? ''}`,
        0,
        0,
      );
    },
  });
}
