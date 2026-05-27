/**
 * submit_plan tool — available during the plan phase.
 *
 * The planner calls this to submit a structured plan with typed steps.
 * Writes `.plans/<name>/plan.json` and updates the plans.json manifest.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { mkdir, writeFile } from 'node:fs/promises';
import { readPlansJson, serializePlansJson } from '../plans-json.js';
import { saveHandoff } from '../plan-storage.js';
import { toKebabCase } from '../utils.js';
import type { PlanData, PlanStep } from '../types.js';

export interface SubmitPlanCallbacks {
  onPlanSubmitted: (planDir: string, plan: PlanData) => void;
}

export function registerSubmitPlanTool(pi: ExtensionAPI, callbacks: SubmitPlanCallbacks): void {
  pi.registerTool({
    name: 'submit_plan',
    label: 'Submit Plan',
    description:
      'Submit a structured plan with a title, handoff document, and numbered steps. ' +
      'Each step has a short description (for progress display) and detailed implementation instructions. ' +
      'This finalizes the plan, writes .plans/<name>/plan.json and .plans/<name>/HANDOFF.md.',
    promptSnippet:
      'Submit a structured plan with title, handoff (what/why/context), and steps',
    promptGuidelines: [
      'Call submit_plan once when you have finished analyzing the codebase and are ready to finalize your plan.',
      'Each submit_plan step description should be a short label (≤60 chars). Put full implementation instructions in the details field.',
      'The submit_plan handoff field is a markdown document explaining what change is being made, why it matters, and all relevant codebase context (file paths, APIs, patterns, constraints). It must be thorough enough that both a human reviewer and an executor agent with zero prior context can understand the plan.',
    ],
    parameters: Type.Object({
      name: Type.String({
        description: 'Short kebab-case name for the plan (e.g. "add-auth-middleware")',
      }),
      title: Type.String({ description: 'Human-readable plan title' }),
      handoff: Type.String({
        description:
          'Markdown content for HANDOFF.md — explains what change is being made, why, and includes relevant codebase context for the executor',
      }),
      steps: Type.Array(
        Type.Object({
          description: Type.String({
            description: 'Short step label for progress display (≤60 chars)',
          }),
          details: Type.String({
            description: 'Full implementation instructions for this step',
          }),
        }),
        { minItems: 1 },
      ),
    }),

    async execute(_toolCallId, params) {
      const planName = toKebabCase(params.name);
      const planDir = `.plans/${planName}`;

      const steps: PlanStep[] = params.steps.map((s) => ({
        description: s.description.slice(0, 60),
        details: s.details,
        status: 'pending' as const,
      }));

      const plan: PlanData = {
        title: params.title,
        handoff: params.handoff,
        steps,
      };

      // Write plan.json and HANDOFF.md
      await mkdir(planDir, { recursive: true });
      await writeFile(`${planDir}/plan.json`, JSON.stringify(plan, null, 2) + '\n', 'utf-8');
      await saveHandoff(planDir, params.handoff);

      // Update plans.json manifest
      const manifest = await readPlansJson();
      const now = new Date().toISOString();
      manifest[planName] = {
        status: 'in-progress',
        title: params.title,
        created: manifest[planName]?.created ?? now,
        completed: null,
      };
      await writeFile('.plans/plans.json', serializePlansJson(manifest), 'utf-8');

      callbacks.onPlanSubmitted(planDir, plan);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Plan "${params.title}" saved with ${steps.length} steps. Waiting for user to review and execute.`,
          },
        ],
        details: { planDir, plan },
        terminate: true,
      };
    },

    renderCall(args, theme) {
      const name = (args as { name?: string }).name ?? 'plan';
      const title = (args as { title?: string }).title ?? '';
      let content = theme.fg('toolTitle', theme.bold('submit_plan '));
      content += theme.fg('accent', name);
      if (title) {
        content += ' ' + theme.fg('dim', `"${title}"`);
      }
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as { plan?: PlanData } | undefined;
      const plan = details?.plan;
      if (!plan) {
        return new Text(theme.fg('success', '✓ Plan saved'), 0, 0);
      }

      const lines: string[] = [];

      // Title
      lines.push(theme.fg('success', '✓ ') + theme.fg('accent', theme.bold(plan.title)));
      lines.push('');

      // Steps
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const num = theme.fg('muted', `${i + 1}.`);
        lines.push(`  ${num} ${step.description}`);
      }

      return new Text(lines.join('\n'), 0, 0);
    },
  });
}
