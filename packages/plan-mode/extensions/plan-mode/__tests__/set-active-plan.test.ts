import { describe, expect, test } from 'bun:test';
import { registerSetActivePlanTool } from '../tools/set-active-plan.js';
import type { PlanData } from '../types.js';
import type { ResolvedPlan } from '../resolve-plan.js';

const now = '2026-05-27T12:00:00.000Z';

interface CapturedTool {
  execute: (
    id: string,
    params: { plan: string },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(resolved: ResolvedPlan): { tool: CapturedTool; requested: string[] } {
  let tool: CapturedTool | undefined;
  const requested: string[] = [];
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerSetActivePlanTool>[0];

  registerSetActivePlanTool(pi, {
    setActivePlan: async (name) => {
      requested.push(name);
      return resolved;
    },
  });

  return { tool: tool!, requested };
}

const plan: PlanData = {
  title: 'My Plan',
  planName: 'my-plan',
  handoff: '',
  tasks: [
    {
      _type: 'task',
      id: 't-001',
      description: 'do',
      status: 'pending',
      created_at: now,
      updated_at: now,
    },
  ],
};

describe('set_active_plan tool', () => {
  test('pins the plan and confirms when resolution succeeds', async () => {
    const { tool, requested } = setup({ plan, candidates: [] });
    const result = await tool.execute('c', { plan: '.plans/my-plan' });

    expect(requested).toEqual(['.plans/my-plan']);
    const details = result.details as { active?: boolean; plan_name?: string; title?: string };
    expect(details.active).toBe(true);
    expect(details.plan_name).toBe('my-plan');
    expect(details.title).toBe('My Plan');
    expect(result.content?.[0]?.text).toMatch(/my-plan/);
  });

  test('reports not_found with candidates (no throw) when unresolved', async () => {
    const { tool } = setup({ plan: undefined, candidates: ['alpha', 'beta'] });
    const result = await tool.execute('c', { plan: 'ghost' });

    const details = result.details as { error?: string; candidates?: string[] };
    expect(details.error).toBe('not_found');
    expect(details.candidates).toEqual(['alpha', 'beta']);
    expect(result.content?.[0]?.text).toMatch(/alpha, beta/);
  });
});
