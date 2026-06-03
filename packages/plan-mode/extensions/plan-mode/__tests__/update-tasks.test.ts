import { describe, expect, test } from 'bun:test';
import { registerUpdateTasksTool } from '../tools/update-tasks.js';
import type { PlanData, TaskRecord, TaskStatus } from '../types.js';

const now = '2026-05-27T12:00:00.000Z';

interface CapturedTool {
  execute: (
    id: string,
    params: {
      updates: Array<{ task_id: string; status: 'done' | 'skipped'; notes?: string }>;
      plan?: string;
    },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown; terminate?: boolean }>;
}

function setup(plan: PlanData | undefined, candidates: string[] = []) {
  let tool: CapturedTool | undefined;
  const updates: Array<{ taskId: string; status: string; notes?: string }> = [];
  // Count how many times the coalesced write callback fires — must be ≤ 1 per call.
  let writeCount = 0;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerUpdateTasksTool>[0];

  registerUpdateTasksTool(pi, {
    resolvePlan: async () => ({ plan, candidates }),
    onTasksUpdated: (batch) => {
      writeCount += 1;
      for (const { taskId, status, notes } of batch) {
        const target = plan?.tasks.find((candidate) => candidate.id === taskId);
        if (target) target.status = status;
        updates.push({ taskId, status, notes });
      }
    },
  });

  return { tool: tool!, updates, getWriteCount: () => writeCount };
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

describe('update_tasks tool', () => {
  test('marks multiple pending tasks (mixed statuses) in a SINGLE write and reports progress', async () => {
    const { tool, updates, getWriteCount } = setup(
      basePlan([planTask('t-001'), planTask('t-002'), planTask('t-003')]),
    );
    const result = await tool.execute('c', {
      updates: [
        { task_id: 't-001', status: 'done', notes: 'a' },
        { task_id: 't-002', status: 'skipped', notes: 'b' },
      ],
    });
    expect(updates).toEqual([
      { taskId: 't-001', status: 'done', notes: 'a' },
      { taskId: 't-002', status: 'skipped', notes: 'b' },
    ]);
    // The whole point of the batch tool: one coalesced write, not one per task.
    expect(getWriteCount()).toBe(1);
    expect(result.content?.[0]?.text).toMatch(/Progress: 2\/3/);
    expect(result.terminate).toBeUndefined();
  });

  test('soft-skips (no throw) when there is no active plan', async () => {
    const { tool, updates } = setup(undefined, ['alpha', 'beta']);
    const result = await tool.execute('c', { updates: [{ task_id: 't-001', status: 'done' }] });
    expect((result.details as { skipped?: boolean }).skipped).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/alpha, beta/);
    expect(updates).toHaveLength(0);
  });

  test('no write when every item is a no-op or not_found', async () => {
    const { tool, getWriteCount } = setup(basePlan([planTask('t-001', 'done')]));
    await tool.execute('c', {
      updates: [
        { task_id: 't-001', status: 'done' },
        { task_id: 't-999', status: 'done' },
      ],
    });
    expect(getWriteCount()).toBe(0);
  });

  test('mixed batch: valid applied, unknown id reported as not_found', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001'), planTask('t-002')]));
    const result = await tool.execute('c', {
      updates: [
        { task_id: 't-001', status: 'done' },
        { task_id: 't-999', status: 'done' },
      ],
    });
    expect(updates).toEqual([{ taskId: 't-001', status: 'done', notes: undefined }]);
    const details = result.details as { results?: Array<{ task_id: string; outcome: string }> };
    expect(details.results?.find((r) => r.task_id === 't-999')?.outcome).toBe('not_found');
  });

  test('idempotent: re-marking the same status is a per-item no-op', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001', 'done'), planTask('t-002')]));
    const result = await tool.execute('c', {
      updates: [
        { task_id: 't-001', status: 'done' },
        { task_id: 't-002', status: 'done' },
      ],
    });
    expect(updates).toEqual([{ taskId: 't-002', status: 'done', notes: undefined }]);
    const details = result.details as { results?: Array<{ task_id: string; outcome: string }> };
    expect(details.results?.find((r) => r.task_id === 't-001')?.outcome).toBe('noop');
  });

  test('corrects an already-resolved task (done → skipped)', async () => {
    const { tool, updates } = setup(basePlan([planTask('t-001', 'done')]));
    await tool.execute('c', { updates: [{ task_id: 't-001', status: 'skipped' }] });
    expect(updates).toEqual([{ taskId: 't-001', status: 'skipped', notes: undefined }]);
  });
});
