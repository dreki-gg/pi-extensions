/**
 * update_tasks tool — batch sibling of update_task.
 *
 * Marks several tasks done/skipped in a single call. Unlike update_task it
 * never blocks (blocking pauses the turn, which is ambiguous mid-batch) and
 * therefore never terminates. Each item mirrors update_task's per-task
 * semantics: idempotent no-ops, corrections, and soft not_found handling.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { StringEnum } from '@earendil-works/pi-ai';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { TaskStatus } from '../types.js';
import type { ResolvedPlan } from '../resolve-plan.js';

export interface UpdateTasksCallbacks {
  /** Resolve the active plan, attaching from disk when none is in memory. */
  resolvePlan: (opts?: { name?: string }) => Promise<ResolvedPlan>;
  /**
   * Apply ALL accepted updates in one shot. The implementation mutates the
   * in-memory tasks, then performs a SINGLE coalesced tasks.jsonl write and
   * registry reconcile — avoiding the per-task write storm that caused file
   * write contention with repeated update_task calls.
   */
  onTasksUpdated: (
    updates: Array<{
      taskId: string;
      status: Exclude<TaskStatus, 'pending' | 'blocked' | 'deferred'>;
      notes?: string;
    }>,
  ) => void | Promise<void>;
}

/** A non-terminating tool result — task tracking must never derail real work. */
function soft(text: string, details: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text }], details };
}

type ItemOutcome = 'updated' | 'noop' | 'not_found';

interface ItemResult {
  task_id: string;
  outcome: ItemOutcome;
  status?: 'done' | 'skipped';
  prior?: string;
}

export function registerUpdateTasksTool(pi: ExtensionAPI, callbacks: UpdateTasksCallbacks): void {
  pi.registerTool({
    name: 'update_tasks',
    label: 'Update Tasks',
    description:
      'Mark several plan tasks done or skipped in one call. Use when you finished multiple tasks in a turn. Cannot block — use update_task for that.',
    promptSnippet: 'Mark multiple plan tasks done or skipped in one call',
    promptGuidelines: [
      'Use update_tasks to resolve several finished tasks at once instead of repeated update_task calls.',
      'Each item is { task_id, status: done|skipped, notes? }. To block a task, use update_task instead.',
      'Always include notes summarizing what was done or why skipped.',
    ],
    parameters: Type.Object({
      updates: Type.Array(
        Type.Object({
          task_id: Type.String({ description: 'Task ID (for example, t-001)' }),
          status: StringEnum(['done', 'skipped'] as const),
          notes: Type.Optional(
            Type.String({ description: 'What was done or why skipped' }),
          ),
        }),
        { description: 'Tasks to mark, each with its own status and notes', minItems: 1 },
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

      const results: ItemResult[] = [];
      const accepted: Array<{ taskId: string; status: 'done' | 'skipped'; notes?: string }> = [];
      for (const update of params.updates) {
        const task = plan.tasks.find((candidate) => candidate.id === update.task_id);
        if (!task) {
          results.push({ task_id: update.task_id, outcome: 'not_found' });
          continue;
        }
        // Idempotent: re-marking the same status is a no-op (safe to retry).
        if (task.status === update.status) {
          results.push({ task_id: update.task_id, outcome: 'noop', status: update.status });
          continue;
        }
        // A different status on an already-resolved task is a CORRECTION — apply
        // it. The plan queue recomputes from the new status.
        results.push({
          task_id: update.task_id,
          outcome: 'updated',
          status: update.status,
          prior: task.status,
        });
        accepted.push({ taskId: update.task_id, status: update.status, notes: update.notes });
      }

      // SINGLE coalesced write: apply every accepted change in one callback,
      // which performs exactly one tasks.jsonl write + one registry reconcile.
      if (accepted.length > 0) await callbacks.onTasksUpdated(accepted);

      const updated = results.filter((r) => r.outcome === 'updated');
      const noop = results.filter((r) => r.outcome === 'noop');
      const notFound = results.filter((r) => r.outcome === 'not_found');

      const done = plan.tasks.filter((candidate) => candidate.status === 'done').length;
      const skipped = plan.tasks.filter((candidate) => candidate.status === 'skipped').length;
      const resolved = done + skipped;
      const next = plan.tasks.find((candidate) => candidate.status === 'pending');

      const parts = [`Updated ${updated.length} task(s).`];
      if (noop.length) parts.push(`${noop.length} no-op.`);
      if (notFound.length) {
        const ids = plan.tasks.map((candidate) => candidate.id).join(', ');
        parts.push(`Not found: ${notFound.map((r) => r.task_id).join(', ')} (valid: ${ids}).`);
      }
      let text = parts.join(' ');
      text += ` Progress: ${resolved}/${plan.tasks.length}`;
      text += next ? `\n\nNext task ${next.id}: ${next.description}` : '\n\nAll tasks resolved!';

      // Never terminate: update_tasks has no blocked path, and completion is
      // handled out-of-band by the agent_end handler in index.ts.
      return { content: [{ type: 'text' as const, text }], details: { results } };
    },

    renderCall(args, theme) {
      const updates = (args as { updates?: Array<{ task_id?: string }> }).updates ?? [];
      let content = theme.fg('toolTitle', theme.bold('update_tasks '));
      content += theme.fg('muted', updates.map((u) => u.task_id ?? '?').join(', '));
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as { results?: ItemResult[] } | undefined;
      const results = details?.results ?? [];
      if (results.length === 0) return new Text(theme.fg('dim', 'Updated'), 0, 0);
      const icon: Record<string, string> = {
        done: theme.fg('success', '✓'),
        skipped: theme.fg('warning', '⊘'),
      };
      const line = results
        .map((r) => {
          if (r.outcome === 'not_found') return theme.fg('error', `✗ ${r.task_id}`);
          if (r.outcome === 'noop') return theme.fg('dim', `= ${r.task_id}`);
          return `${icon[r.status ?? ''] ?? ''} ${r.task_id}`;
        })
        .join('  ');
      return new Text(line, 0, 0);
    },
  });
}
