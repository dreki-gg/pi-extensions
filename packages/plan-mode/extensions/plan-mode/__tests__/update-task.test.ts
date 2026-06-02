import { describe, expect, test } from 'bun:test';
import { registerUpdateTaskTool } from '../tools/update-task.js';
import type { PlanData, TaskRecord, TaskStatus } from '../types.js';

const now = '2026-05-27T12:00:00.000Z';

interface CapturedTool {
  execute: (
    id: string,
    params: {
      task_id: string;
      status: 'done' | 'skipped' | 'blocked';
      notes?: string;
      plan?: string;
    },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown; terminate?: boolean }>;
}

function setup(plan: PlanData | undefined, candidates: string[] = []) {
  let tool: CapturedTool | undefined;
  const updates: Array<{ taskId: string; status: string; notes?: string }> = [];
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerUpdateTaskTool>[0];

  registerUpdateTaskTool(pi, {
    resolvePlan: async () => ({ plan, candidates }),
    onTaskUpdated: (taskId, status, notes) => {
      const target = plan?.tasks.find((candidate) => candidate.id === taskId);
      if (target) target.status = status;
      updates.push({ taskId, status, notes });
    },
  });

  return { tool: tool!, updates };
}

const basePlan = (tasks: TaskRecord[]): PlanData => ({
  title: 'Plan',
  planName: 'plan',
  handoff: '',
  tasks,
});
const planTask = (id: string, status: TaskStatus = 'pending'): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status,
  origin: 'plan',
  created_at: now,
  updated_at: now,
});

describe('update_task tool', () => {
  test('marks a pending task and reports progress', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001'), planTask('t-002')]));
    const result = await tool.execute('c', { task_id: 't-001', status: 'done', notes: 'did it' });
    expect(updates).toEqual([{ taskId: 't-001', status: 'done', notes: 'did it' }]);
    expect(result.content?.[0]?.text).toMatch(/Progress: 1\/2/);
  });

  test('blocked terminates the turn', async () => {
    const { tool } = setup(basePlan([planTask('t-001')]));
    const result = await tool.execute('c', { task_id: 't-001', status: 'blocked' });
    expect(result.terminate).toBe(true);
  });

  test('soft-skips (no throw) when there is no active plan', async () => {
    const { tool, updates } = setup(undefined, ['alpha', 'beta']);
    const result = await tool.execute('c', { task_id: 't-001', status: 'done' });
    expect((result.details as { skipped?: boolean }).skipped).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/alpha, beta/);
    expect(updates).toHaveLength(0);
  });

  test('soft result (no throw) for an unknown task id', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001')]));
    const result = await tool.execute('c', { task_id: 't-999', status: 'done' });
    expect((result.details as { error?: string }).error).toBe('not_found');
    expect(result.content?.[0]?.text).toMatch(/t-001/);
    expect(updates).toHaveLength(0);
  });

  test('idempotent: re-marking the same status is a no-op success', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001', 'done')]));
    const result = await tool.execute('c', { task_id: 't-001', status: 'done' });
    expect(result.content?.[0]?.text).toMatch(/no-op/);
    expect(updates).toHaveLength(0);
  });

  test('corrects an already-resolved task (done → skipped) and reports it', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001', 'done')]));
    const result = await tool.execute('c', { task_id: 't-001', status: 'skipped' });
    expect(updates).toEqual([{ taskId: 't-001', status: 'skipped', notes: undefined }]);
    expect(result.content?.[0]?.text).toMatch(/corrected \(done → skipped\)/);
  });

  test('unblocks a task (blocked → done) without terminating', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001', 'blocked')]));
    const result = await tool.execute('c', { task_id: 't-001', status: 'done' });
    expect(updates).toEqual([{ taskId: 't-001', status: 'done', notes: undefined }]);
    expect(result.terminate).toBeUndefined();
  });
});
