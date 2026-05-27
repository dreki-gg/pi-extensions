/**
 * update_step tool — available during the execution phase.
 *
 * The executor calls this to mark a plan step as done, skipped, or blocked.
 * On "blocked", returns a stop signal so the executor pauses for user intervention.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { StringEnum } from '@earendil-works/pi-ai';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { PlanData } from '../types.js';

export interface UpdateStepCallbacks {
  getPlan: () => PlanData | undefined;
  onStepUpdated: (step: number, status: 'done' | 'skipped' | 'blocked', notes?: string) => void;
}

export function registerUpdateStepTool(pi: ExtensionAPI, callbacks: UpdateStepCallbacks): void {
  pi.registerTool({
    name: 'update_step',
    label: 'Update Step',
    description:
      'Mark a plan step as done, skipped, or blocked. ' +
      'Call this after completing each step. ' +
      'If a step is blocked, execution will pause for user intervention.',
    promptSnippet: 'Mark a plan step as done, skipped, or blocked',
    promptGuidelines: [
      'Call update_step after completing each plan step to mark it done before moving to the next.',
      'Always include notes when calling update_step — summarize what was done (files changed, key decisions made) for done steps, why it was unnecessary for skipped steps, or what went wrong for blocked steps.',
      'Use update_step with status "skipped" if a step is unnecessary after inspecting the code.',
      'Use update_step with status "blocked" and explain the reason in notes if a step cannot be completed — execution will pause for user input.',
    ],
    parameters: Type.Object({
      step: Type.Number({ description: 'Step number (1-indexed)' }),
      status: StringEnum(['done', 'skipped', 'blocked'] as const),
      notes: Type.Optional(
        Type.String({ description: 'What was done, why skipped, or why blocked' }),
      ),
    }),

    async execute(_toolCallId, params) {
      const plan = callbacks.getPlan();
      if (!plan) {
        throw new Error('No active plan. Cannot update step.');
      }

      const stepIdx = params.step - 1;
      if (stepIdx < 0 || stepIdx >= plan.steps.length) {
        throw new Error(
          `Invalid step number ${params.step}. Plan has ${plan.steps.length} steps.`,
        );
      }

      const step = plan.steps[stepIdx];
      if (step.status !== 'pending') {
        throw new Error(
          `Step ${params.step} is already "${step.status}". Only pending steps can be updated.`,
        );
      }

      callbacks.onStepUpdated(params.step, params.status, params.notes);

      const details = {
        step: params.step,
        status: params.status,
        notes: params.notes,
        description: step.description,
      };

      if (params.status === 'blocked') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Step ${params.step} blocked. Execution paused — waiting for user input.`,
            },
          ],
          details,
          terminate: true,
        };
      }

      // Build progress info
      const done = plan.steps.filter((s) => s.status === 'done').length;
      const skipped = plan.steps.filter((s) => s.status === 'skipped').length;
      const resolved = done + skipped;

      const statusEmoji = params.status === 'done' ? '✓' : '⊘';
      let text = `${statusEmoji} Step ${params.step} ${params.status}. Progress: ${resolved}/${plan.steps.length}`;
      if (params.notes) {
        text += ` — ${params.notes}`;
      }

      // Find next pending step
      const next = plan.steps.find((s) => s.status === 'pending');
      if (next) {
        const nextIdx = plan.steps.indexOf(next) + 1;
        text += `\n\nNext step ${nextIdx}: ${next.description}`;
      } else {
        text += '\n\nAll steps resolved!';
      }

      return {
        content: [{ type: 'text' as const, text }],
        details,
        // Stop the agent when all steps are done so agent_end fires immediately
        terminate: !next,
      };
    },

    renderCall(args, theme) {
      const step = (args as { step?: number }).step ?? '?';
      const status = (args as { status?: string }).status ?? '';
      let content = theme.fg('toolTitle', theme.bold('update_step '));
      content += theme.fg('muted', `#${step}`);
      if (status) {
        const color = status === 'done' ? 'success' : status === 'skipped' ? 'warning' : 'error';
        content += ' ' + theme.fg(color, status);
      }
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as {
        step?: number;
        status?: string;
        description?: string;
      } | undefined;

      if (!details) {
        return new Text(theme.fg('dim', 'Updated'), 0, 0);
      }

      const statusMap: Record<string, string> = {
        done: theme.fg('success', '✓'),
        skipped: theme.fg('warning', '⊘'),
        blocked: theme.fg('error', '✗'),
      };

      const icon = statusMap[details.status ?? ''] ?? '';
      const desc = details.description ?? '';
      return new Text(`${icon} Step ${details.step}: ${desc}`, 0, 0);
    },
  });
}
