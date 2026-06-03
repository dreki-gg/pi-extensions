/**
 * update_task tool — available during execution and after exiting plan mode with a submitted plan.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { StringEnum } from '@earendil-works/pi-ai';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { TaskStatus } from '../types.js';
import type { ResolvedPlan } from '../resolve-plan.js';

export interface UpdateTaskCallbacks {
  /** Resolve the active plan, attaching from disk when none is in memory. */
  resolvePlan: (opts?: { name?: string }) => Promise<ResolvedPlan>;
  onTaskUpdated: (
    taskId: string,
    status: Exclude<TaskStatus, 'pending'>,
    notes?: string,
  ) => void | Promise<void>;
}

/** A non-terminating tool result — task tracking must never derail real work. */
function soft(text: string, details: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text }], details };
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
      plan: Type.Optional(
        Type.String({
          description:
            'Plan name (or .plans/<name>) to target. Only needed to disambiguate when multiple plans are in-progress; otherwise the active / sole in-progress plan is used.',
        }),
      ),
    }),

    async execute(_toolCallId, params) {
      const { plan, candidates } = await callbacks.resolvePlan({ name: params.plan });
      // No active plan is a tracking miss, not an error: return a soft result
      // (non-terminating) so the agent keeps doing the real work.
      if (!plan) {
        const hint =
          candidates.length > 1
            ? ` Multiple in-progress plans (${candidates.join(', ')}) — pass { plan: "<name>" } to choose.`
            : ' No in-progress plan found in .plans/plans.jsonl.';
        return soft(`Skipped task tracking — no active plan.${hint}`, {
          skipped: true,
          candidates,
        });
      }

      const task = plan.tasks.find((candidate) => candidate.id === params.task_id);
      if (!task) {
        const ids = plan.tasks.map((candidate) => candidate.id).join(', ');
        return soft(`Task not found: ${params.task_id}. Valid ids: ${ids || '(none)'}`, {
          error: 'not_found',
          task_id: params.task_id,
        });
      }
      // Idempotent: re-marking the same status is a no-op success (safe to
      // retry).
      if (task.status === params.status) {
        return soft(`Task ${params.task_id} already ${params.status} (no-op).`, {
          task_id: params.task_id,
          status: params.status,
          description: task.description,
        });
      }
      // A different status on an already-resolved task is a CORRECTION — apply
      // it (e.g. done→skipped, or blocked→done to unblock). The status is the
      // edit; the plan queue recomputes from it.
      const wasCorrection = task.status !== 'pending';
      const priorStatus = task.status;

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
      const verb = wasCorrection ? `corrected (${priorStatus} → ${params.status})` : params.status;
      let text = `${statusEmoji} Task ${params.task_id} ${verb}. Progress: ${resolved}/${plan.tasks.length}`;
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
