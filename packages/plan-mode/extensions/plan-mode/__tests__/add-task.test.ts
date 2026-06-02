import { describe, expect, test } from 'bun:test';
import { registerAddTaskTool } from '../tools/add-task.js';
import type { PlanData, TaskRecord } from '../types.js';

const now = '2026-05-27T12:00:00.000Z';

interface CapturedTool {
  execute: (
    id: string,
    params: {
      description: string;
      reason: string;
      details?: string;
      depends_on?: string[];
      plan?: string;
    },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(plan: PlanData | undefined) {
  let tool: CapturedTool | undefined;
  const added: TaskRecord[] = [];
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerAddTaskTool>[0];

  registerAddTaskTool(pi, {
    // Mirrors index.ts: in-memory plan wins; disk fallback returns candidates.
    resolvePlan: async () => ({ plan, candidates: [] }),
    onTaskAdded: (task) => {
      added.push(task);
    },
  });

  return { tool: tool!, added };
}

const basePlan = (tasks: TaskRecord[]): PlanData => ({
  title: 'Plan',
  planName: 'plan',
  handoff: '',
  tasks,
});

const planTask = (id: string): TaskRecord => ({
  _type: 'task',
  id,
  description: 'planned',
  status: 'done',
  origin: 'plan',
  created_at: now,
  updated_at: now,
});

describe('add_task tool', () => {
  test('captures a deferred discovered task with a generated id and reason as notes', async () => {
    const plan = basePlan([planTask('t-001'), planTask('t-002')]);
    const { tool, added } = setup(plan);

    await tool.execute('call-1', {
      description: 'Extract shared helper',
      reason: 'noticed duplication while editing',
    });

    expect(added).toHaveLength(1);
    const task = added[0];
    expect(task.id).toBe('t-003');
    expect(task.status).toBe('deferred');
    expect(task.origin).toBe('discovered');
    expect(task.notes).toBe('noticed duplication while editing');
    expect(task.description).toBe('Extract shared helper');
  });

  test('soft-skips (does not throw) when there is no active plan', async () => {
    const { tool, added } = setup(undefined);
    const result = await tool.execute('call-1', { description: 'x', reason: 'y' });
    expect((result.details as { skipped?: boolean }).skipped).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/no active plan/i);
    expect(added).toHaveLength(0);
  });
});
