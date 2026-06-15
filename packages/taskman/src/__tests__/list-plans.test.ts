import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { upsertPlanEntry } from '../storage/plans-manifest.js';
import { writeTasksJsonl } from '../storage/task-storage.js';
import type { TaskMeta, TaskRecord } from '../types.js';
import {
  filterPlans,
  sortPlans,
  formatPlanList,
  parseListArgs,
  loadPlanListItems,
  type PlanListItem,
} from '../listing/plans.js';

const runPlanIO = makePlanRuntime();
const originalCwd = process.cwd();
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-list-'));
  chdir(dir);
});

afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const meta = (name: string): TaskMeta => ({
  _type: 'meta',
  title: `Title ${name}`,
  plan_name: name,
  created_at: '2026-01-01T00:00:00.000Z',
});

const task = (id: string, status: 'done' | 'pending' = 'done'): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status,
  origin: 'plan',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

function makePlanItem(overrides: Partial<PlanListItem> & { name: string }): PlanListItem {
  return {
    title: `Title ${overrides.name}`,
    status: 'in-progress',
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
    totalTasks: 3,
    doneTasks: 1,
    pendingTasks: 2,
    ...overrides,
  };
}

// ── filterPlans ──────────────────────────────────────────────────────────────

describe('filterPlans', () => {
  const plans: PlanListItem[] = [
    makePlanItem({ name: 'alpha', status: 'in-progress' }),
    makePlanItem({ name: 'beta', status: 'done' }),
    makePlanItem({ name: 'gamma', status: 'abandoned' }),
  ];

  test('returns all when filter is "all"', () => {
    expect(filterPlans(plans, 'all')).toHaveLength(3);
  });

  test('filters by in-progress', () => {
    const result = filterPlans(plans, 'in-progress');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('alpha');
  });

  test('filters by done', () => {
    const result = filterPlans(plans, 'done');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('beta');
  });

  test('filters by abandoned', () => {
    const result = filterPlans(plans, 'abandoned');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('gamma');
  });

  test('returns empty when no match', () => {
    expect(filterPlans(plans, 'superseded')).toHaveLength(0);
  });
});

// ── sortPlans ────────────────────────────────────────────────────────────────

describe('sortPlans', () => {
  const plans: PlanListItem[] = [
    makePlanItem({ name: 'charlie', created_at: '2026-03-01T00:00:00.000Z', totalTasks: 2 }),
    makePlanItem({ name: 'alpha', created_at: '2026-01-01T00:00:00.000Z', totalTasks: 5 }),
    makePlanItem({ name: 'bravo', created_at: '2026-02-01T00:00:00.000Z', totalTasks: 1 }),
  ];

  test('sorts by name', () => {
    const result = sortPlans(plans, 'name');
    expect(result.map((p) => p.name)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  test('sorts by date ascending (oldest first)', () => {
    const result = sortPlans(plans, 'date-asc');
    expect(result.map((p) => p.name)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  test('sorts by date descending (newest first)', () => {
    const result = sortPlans(plans, 'date-desc');
    expect(result.map((p) => p.name)).toEqual(['charlie', 'bravo', 'alpha']);
  });

  test('sorts by task count (most tasks first)', () => {
    const result = sortPlans(plans, 'tasks');
    expect(result.map((p) => p.name)).toEqual(['alpha', 'charlie', 'bravo']);
  });

  test('does not mutate the original array', () => {
    const original = [...plans];
    sortPlans(plans, 'name');
    expect(plans.map((p) => p.name)).toEqual(original.map((p) => p.name));
  });
});

// ── formatPlanList ───────────────────────────────────────────────────────────

describe('formatPlanList', () => {
  test('shows message when empty and filter is all', () => {
    expect(formatPlanList([], 'all', 'date-desc')).toContain('No plans found');
  });

  test('shows filter-specific message when empty', () => {
    expect(formatPlanList([], 'done', 'date-desc')).toContain('No plans with status "done"');
  });

  test('includes plan details in output', () => {
    const plans = [
      makePlanItem({ name: 'alpha', title: 'Alpha Plan', totalTasks: 5, doneTasks: 3 }),
    ];
    const output = formatPlanList(plans, 'all', 'date-desc');
    expect(output).toContain('alpha');
    expect(output).toContain('Alpha Plan');
    expect(output).toContain('3/5 tasks');
  });

  test('shows header with count and sort', () => {
    const plans = [makePlanItem({ name: 'a' }), makePlanItem({ name: 'b' })];
    const output = formatPlanList(plans, 'all', 'tasks');
    expect(output).toContain('All plans (2)');
    expect(output).toContain('most tasks first');
  });
});

// ── parseListArgs ────────────────────────────────────────────────────────────────

describe('parseListArgs', () => {
  test('parses filter only', () => {
    expect(parseListArgs('done')).toEqual({ filter: 'done', sort: 'date-desc' });
  });

  test('parses sort only', () => {
    expect(parseListArgs('oldest')).toEqual({ filter: 'all', sort: 'date-asc' });
  });

  test('parses filter and sort together', () => {
    expect(parseListArgs('in-progress tasks')).toEqual({ filter: 'in-progress', sort: 'tasks' });
  });

  test('accepts aliases', () => {
    expect(parseListArgs('pending newest')).toEqual({ filter: 'in-progress', sort: 'date-desc' });
    expect(parseListArgs('active oldest')).toEqual({ filter: 'in-progress', sort: 'date-asc' });
    expect(parseListArgs('completed name')).toEqual({ filter: 'done', sort: 'name' });
  });

  test('defaults to all + date-desc for unknown tokens', () => {
    expect(parseListArgs('unknown gibberish')).toEqual({ filter: 'all', sort: 'date-desc' });
  });

  test('is case-insensitive', () => {
    expect(parseListArgs('DONE TASKS')).toEqual({ filter: 'done', sort: 'tasks' });
  });
});

// ── loadPlanListItems (integration) ──────────────────────────────────────────

describe('loadPlanListItems', () => {
  test('returns empty for no plans', async () => {
    const items = await runPlanIO(loadPlanListItems());
    expect(items).toEqual([]);
  });

  test('loads plans with task counts', async () => {
    await runPlanIO(upsertPlanEntry('alpha', { status: 'in-progress', title: 'Alpha' }));
    await runPlanIO(
      writeTasksJsonl('.plans/alpha', meta('alpha'), [
        task('t-001', 'done'),
        task('t-002', 'pending'),
        task('t-003', 'pending'),
      ]),
    );

    const items = await runPlanIO(loadPlanListItems());
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('alpha');
    expect(items[0].totalTasks).toBe(3);
    expect(items[0].doneTasks).toBe(1);
    expect(items[0].pendingTasks).toBe(2);
  });

  test('handles plans without task files', async () => {
    await runPlanIO(upsertPlanEntry('orphan', { status: 'in-progress', title: 'Orphan' }));

    const items = await runPlanIO(loadPlanListItems());
    expect(items).toHaveLength(1);
    expect(items[0].totalTasks).toBe(0);
    expect(items[0].doneTasks).toBe(0);
  });

  test('loads multiple plans', async () => {
    await runPlanIO(upsertPlanEntry('alpha', { status: 'in-progress', title: 'Alpha' }));
    await runPlanIO(upsertPlanEntry('beta', { status: 'done', title: 'Beta' }));
    await runPlanIO(writeTasksJsonl('.plans/alpha', meta('alpha'), [task('t-001', 'pending')]));
    await runPlanIO(
      writeTasksJsonl('.plans/beta', meta('beta'), [task('t-001', 'done'), task('t-002', 'done')]),
    );

    const items = await runPlanIO(loadPlanListItems());
    expect(items).toHaveLength(2);

    const alpha = items.find((i) => i.name === 'alpha')!;
    expect(alpha.status).toBe('in-progress');
    expect(alpha.totalTasks).toBe(1);

    const beta = items.find((i) => i.name === 'beta')!;
    expect(beta.status).toBe('done');
    expect(beta.totalTasks).toBe(2);
    expect(beta.doneTasks).toBe(2);
  });
});
