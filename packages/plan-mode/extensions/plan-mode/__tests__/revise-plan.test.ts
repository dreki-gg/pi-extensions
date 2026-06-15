import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { registerRevisePlanTool } from '../tools/revise-plan.js';
import { readTasksJsonl, writeTasksJsonl } from '@dreki-gg/taskman';
import { saveHandoff, loadHandoff } from '@dreki-gg/taskman';
import { readPlansManifest, upsertPlanEntry } from '@dreki-gg/taskman';
import type { PlanData, TaskRecord } from '../types.js';

const runPlanIO = makePlanRuntime();
const now = '2026-05-27T12:00:00.000Z';

interface CapturedTool {
  execute: (
    id: string,
    params: {
      plan: string;
      title?: string;
      handoff?: string;
      tasks?: Array<{
        id: string;
        description: string;
        details?: string;
        depends_on?: string[];
      }>;
      initiative?: string;
      depends_on_plans?: string[];
    },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(plan: PlanData | undefined): { tool: CapturedTool; revised: PlanData[] } {
  let tool: CapturedTool | undefined;
  const revised: PlanData[] = [];
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerRevisePlanTool>[0];

  registerRevisePlanTool(pi, runPlanIO, {
    resolvePlan: async () => ({ plan, candidates: plan ? [] : ['other'] }),
    onPlanRevised: (_dir, p) => {
      revised.push(p);
    },
  });

  return { tool: tool!, revised };
}

const task = (id: string, over: Partial<TaskRecord> = {}): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  details: '',
  status: 'pending',
  origin: 'plan',
  created_at: now,
  updated_at: now,
  ...over,
});

async function seed(plan: PlanData): Promise<void> {
  const dir = `.plans/${plan.planName}`;
  await runPlanIO(
    writeTasksJsonl(
      dir,
      { _type: 'meta', title: plan.title, plan_name: plan.planName, created_at: now },
      plan.tasks,
    ),
  );
  await runPlanIO(saveHandoff(dir, plan.handoff));
}

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-revise-plan-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('revise_plan tool', () => {
  test('rewrites handoff + title only, leaving tasks untouched', async () => {
    const plan: PlanData = {
      title: 'Old title',
      planName: 'p',
      handoff: 'old handoff',
      tasks: [task('t-001'), task('t-002')],
    };
    await seed(plan);
    await runPlanIO(upsertPlanEntry('p', { status: 'in-progress', title: 'Old title' }));

    const { tool } = setup(plan);
    await tool.execute('c', { plan: 'p', title: 'New title', handoff: 'new handoff' });

    const snapshot = await runPlanIO(readTasksJsonl('.plans/p'));
    expect(snapshot?.meta.title).toBe('New title');
    expect(snapshot?.tasks.map((t) => t.id)).toEqual(['t-001', 't-002']);
    expect(await runPlanIO(loadHandoff('.plans/p'))).toBe('new handoff');
    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.title).toBe('New title');
    expect(entry.status).toBe('in-progress');
  });

  test('replaces task set but preserves status/notes for matching ids', async () => {
    const plan: PlanData = {
      title: 'P',
      planName: 'p',
      handoff: 'h',
      tasks: [
        task('t-001', { status: 'done', notes: 'shipped' }),
        task('t-002', { status: 'pending' }),
      ],
    };
    await seed(plan);
    await runPlanIO(upsertPlanEntry('p', { status: 'in-progress', title: 'P' }));

    const { tool } = setup(plan);
    await tool.execute('c', {
      plan: 'p',
      tasks: [
        { id: 't-001', description: 'reworded but same id' },
        { id: 't-003', description: 'brand new task' },
      ],
    });

    const snapshot = await runPlanIO(readTasksJsonl('.plans/p'));
    const tasks = snapshot!.tasks;
    expect(tasks.map((t) => t.id)).toEqual(['t-001', 't-003']);
    const t1 = tasks.find((t) => t.id === 't-001')!;
    expect(t1.status).toBe('done');
    expect(t1.notes).toBe('shipped');
    expect(t1.description).toBe('reworded but same id');
    const t3 = tasks.find((t) => t.id === 't-003')!;
    expect(t3.status).toBe('pending');
  });

  test('reopens an all-done plan when a pending task is added', async () => {
    const plan: PlanData = {
      title: 'P',
      planName: 'p',
      handoff: 'h',
      tasks: [task('t-001', { status: 'done' })],
    };
    await seed(plan);
    await runPlanIO(upsertPlanEntry('p', { status: 'done', title: 'P' }));

    const { tool } = setup(plan);
    await tool.execute('c', {
      plan: 'p',
      tasks: [
        { id: 't-001', description: 'done one' },
        { id: 't-002', description: 'new pending work' },
      ],
    });

    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.status).toBe('in-progress');
  });

  test('reports not_found for an unknown plan (no throw)', async () => {
    const { tool } = setup(undefined);
    const result = await tool.execute('c', { plan: 'ghost', title: 'x' });
    expect((result.details as { error?: string }).error).toBe('not_found');
  });

  test('re-links the plan to an initiative and persists plan-level deps', async () => {
    const plan: PlanData = {
      title: 'P',
      planName: 'p',
      handoff: 'h',
      tasks: [task('t-001')],
    };
    await seed(plan);
    await runPlanIO(upsertPlanEntry('p', { status: 'in-progress', title: 'P' }));

    const { tool } = setup(plan);
    await tool.execute('c', {
      plan: 'p',
      initiative: 'Auth Overhaul',
      depends_on_plans: ['Schema First'],
    });

    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.initiative).toBe('auth-overhaul');
    expect(entry.depends_on).toEqual(['schema-first']);
  });

  test('preserves existing initiative link when not passed', async () => {
    const plan: PlanData = { title: 'P', planName: 'p', handoff: 'h', tasks: [task('t-001')] };
    await seed(plan);
    await runPlanIO(
      upsertPlanEntry('p', { status: 'in-progress', title: 'P', initiative: 'big' }),
    );

    const { tool } = setup(plan);
    await tool.execute('c', { plan: 'p', title: 'P2' });

    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.initiative).toBe('big');
  });
});
