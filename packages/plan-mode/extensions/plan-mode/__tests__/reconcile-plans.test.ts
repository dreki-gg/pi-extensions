import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { writeTasksJsonl } from '@dreki-gg/taskman';
import { readPlansManifest, upsertPlanEntry } from '@dreki-gg/taskman';
import { registerReconcilePlansTool } from '../tools/reconcile-plans.js';
import type { TaskMeta, TaskRecord } from '../types.js';

const runPlanIO = makePlanRuntime();
const now = '2026-05-27T12:00:00.000Z';

const meta = (name: string): TaskMeta => ({
  _type: 'meta',
  title: `Title ${name}`,
  plan_name: name,
  created_at: now,
});
const doneTask = (id: string): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status: 'done',
  origin: 'plan',
  created_at: now,
  updated_at: now,
});

interface CapturedTool {
  execute: (
    id: string,
    params: { apply?: boolean },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(): CapturedTool {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerReconcilePlansTool>[0];
  registerReconcilePlansTool(pi, runPlanIO);
  return tool!;
}

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-reconcile-tool-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('reconcile_plans tool', () => {
  test('reports drift read-only without changing the registry', async () => {
    await runPlanIO(writeTasksJsonl('.plans/alpha', meta('alpha'), [doneTask('t-001')]));
    await runPlanIO(upsertPlanEntry('alpha', { status: 'in-progress', title: 'Title alpha' }));

    const tool = setup();
    const result = await tool.execute('c', {});
    expect(result.content?.[0]?.text).toMatch(/drift issue/);
    // Read-only: registry unchanged.
    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.status).toBe('in-progress');
  });

  test('apply:true repairs status drift', async () => {
    await runPlanIO(writeTasksJsonl('.plans/alpha', meta('alpha'), [doneTask('t-001')]));
    await runPlanIO(upsertPlanEntry('alpha', { status: 'in-progress', title: 'Title alpha' }));

    const tool = setup();
    const result = await tool.execute('c', { apply: true });
    expect((result.details as { repaired?: string[] }).repaired).toEqual(['alpha']);
    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.status).toBe('done');
  });
});
