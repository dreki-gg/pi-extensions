/**
 * set_active_plan tool — pin a plan as the active one.
 *
 * The tool-callable form of `/plan focus <name>`. Attaches the named plan into
 * session state so subsequent plan_status / update_task / add_task calls target
 * it. Use when plan_status reports multiple in-progress plans and the agent
 * needs to select one programmatically instead of waiting for `/plan focus`.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import type { ResolvedPlan } from '../resolve-plan.js';

export interface SetActivePlanCallbacks {
  /** Pin the named plan into state (clears stale plan, re-attaches from disk). */
  setActivePlan: (name: string) => Promise<ResolvedPlan>;
}

export function registerSetActivePlanTool(
  pi: ExtensionAPI,
  callbacks: SetActivePlanCallbacks,
): void {
  pi.registerTool({
    name: 'set_active_plan',
    label: 'Set Active Plan',
    description:
      'Pin a plan as the active one so plan_status / update_task / add_task target it. Use when multiple plans are in-progress and you need to select one.',
    promptSnippet: 'Pin a plan as active so tracking calls target it',
    promptGuidelines: [
      'Call set_active_plan when plan_status reports multiple in-progress plans and you need to select one before update_task / add_task.',
      'It is the tool form of the /plan focus command — it attaches the named plan into session state.',
    ],
    parameters: Type.Object({
      plan: Type.String({ description: 'Plan name (or .plans/<name>) to pin as active' }),
    }),

    async execute(_toolCallId, params) {
      const { plan, candidates } = await callbacks.setActivePlan(params.plan);
      if (!plan) {
        const hint = candidates.length ? ` In-progress: ${candidates.join(', ')}.` : '';
        const notFound: Record<string, unknown> = {
          error: 'not_found',
          plan: params.plan,
          candidates,
        };
        return {
          content: [{ type: 'text' as const, text: `Plan not found: ${params.plan}.${hint}` }],
          details: notFound,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Active plan set to ${plan.title} (${plan.planName}).`,
          },
        ],
        details: { active: true, plan_name: plan.planName, title: plan.title },
      };
    },

    renderCall(args, theme) {
      const name = (args as { plan?: string }).plan ?? 'plan';
      return new Text(
        theme.fg('toolTitle', theme.bold('set_active_plan ')) + theme.fg('accent', name),
        0,
        0,
      );
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { active?: boolean; plan_name?: string; title?: string }
        | undefined;
      if (!details?.active) return new Text(theme.fg('dim', 'No plan set'), 0, 0);
      return new Text(
        theme.fg('success', '✓ ') +
          theme.fg('accent', theme.bold(details.title ?? details.plan_name ?? 'plan')),
        0,
        0,
      );
    },
  });
}
