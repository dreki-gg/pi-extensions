import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { upsertPlanEntry } from '@dreki-gg/taskman';
import { writeTasksJsonl } from '@dreki-gg/taskman';
import { saveHandoff } from '@dreki-gg/taskman';
import type { TaskMeta, TaskRecord } from '../types.js';
import { buildPlanContextPack, resolvePlanReference } from '../references/context.js';

const runPlanIO = makePlanRuntime();
const originalCwd = process.cwd();
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-refctx-'));
  chdir(dir);
});

afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

const meta: TaskMeta = {
  _type: 'meta',
  title: 'Add Auth',
  plan_name: 'add-auth',
  created_at: '2026-01-01T00:00:00.000Z',
};

const tasks: TaskRecord[] = [
  {
    _type: 'task',
    id: 't-001',
    description: 'Write middleware',
    status: 'done',
    origin: 'plan',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    _type: 'task',
    id: 't-002',
    description: 'Wire routes',
    status: 'pending',
    origin: 'plan',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

describe('buildPlanContextPack', () => {
  test('includes title, status, tasks, and handoff', () => {
    const pack = buildPlanContextPack('add-auth', 'Add Auth', 'in-progress', tasks, 'Handoff body');
    expect(pack).toContain('Add Auth');
    expect(pack).toContain('add-auth');
    expect(pack).toContain('in-progress');
    expect(pack).toContain('t-001');
    expect(pack).toContain('Write middleware');
    expect(pack).toContain('t-002');
    expect(pack).toContain('Handoff body');
  });
});

describe('resolvePlanReference', () => {
  test('resolves a real plan on disk', async () => {
    await runPlanIO(upsertPlanEntry('add-auth', { status: 'in-progress', title: 'Add Auth' }));
    await runPlanIO(writeTasksJsonl('.plans/add-auth', meta, tasks));
    await runPlanIO(saveHandoff('.plans/add-auth', 'Handoff body'));

    const resolved = await runPlanIO(resolvePlanReference('add-auth'));
    expect(resolved).toBeDefined();
    expect(resolved?.title).toBe('Add Auth');
    expect(resolved?.status).toBe('in-progress');
    expect(resolved?.tasks).toHaveLength(2);
    expect(resolved?.handoff).toBe('Handoff body');
  });

  test('returns undefined for an unknown slug', async () => {
    const resolved = await runPlanIO(resolvePlanReference('nope'));
    expect(resolved).toBeUndefined();
  });
});
