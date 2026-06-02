import { describe, expect, test } from 'bun:test';
import { registerPlanStatusTool } from '../tools/plan-status.js';
import type { PlanData, TaskRecord, TaskStatus } from '../types.js';

const now = '2026-05-27T12:00:00.000Z';

interface CapturedTool {
  execute: (
    id: string,
    params: { plan?: string },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(plan: PlanData | undefined, candidates: string[] = []) {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerPlanStatusTool>[0];
  registerPlanStatusTool(pi, { resolvePlan: async () => ({ plan, candidates }) });
  return tool!;
}

const planTask = (id: string, status: TaskStatus): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status,
  origin: 'plan',
  created_at: now,
  updated_at: now,
});

describe('plan_status tool', () => {
  test('summarizes progress + lists task ids and statuses', async () => {
    const plan: PlanData = {
      title: 'My Plan',
      planName: 'my-plan',
      handoff: '',
      tasks: [
        planTask('t-001', 'done'),
        planTask('t-002', 'pending'),
        planTask('t-003', 'blocked'),
      ],
    };
    const tool = setup(plan);
    const result = await tool.execute('c', {});

    const text = result.content?.[0]?.text ?? '';
    expect(text).toMatch(/My Plan \(my-plan\)/);
    expect(text).toMatch(/1\/3 resolved/);
    expect(text).toMatch(/blocked 1/);
    expect(text).toMatch(/t-002 \[pending\]/);

    const details = result.details as { active: boolean; task_ids: string[]; total: number };
    expect(details.active).toBe(true);
    expect(details.task_ids).toEqual(['t-001', 't-002', 't-003']);
    expect(details.total).toBe(3);
  });

  test('reports no active plan (read-only, no throw) with candidates', async () => {
    const tool = setup(undefined, ['alpha', 'beta']);
    const result = await tool.execute('c', {});
    expect((result.details as { active: boolean }).active).toBe(false);
    expect(result.content?.[0]?.text).toMatch(/alpha, beta/);
  });
});
