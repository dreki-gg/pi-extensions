import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { upsertPlanEntry } from '../storage/plans-manifest.js';
import { writeTasksJsonl } from '../storage/task-storage.js';
import { saveHandoff } from '../storage/plan-storage.js';
import { resolvePlanByName, loadPlanData, normalizePlanName } from '../resolve.js';
import type { TaskMeta, TaskRecord } from '../types.js';

const run = makePlanRuntime();
let cwd: string;
let tmp: string;

const meta = (name: string): TaskMeta => ({
  _type: 'meta',
  title: `Title ${name}`,
  plan_name: name,
  created_at: '2026-01-01T00:00:00.000Z',
});

const task = (id: string): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status: 'pending',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

async function makePlan(name: string, status: 'in-progress' | 'done' = 'in-progress') {
  await run(upsertPlanEntry(name, { status, title: `Title ${name}` }));
  await run(writeTasksJsonl(`.plans/${name}`, meta(name), [task('t-001')]));
}

beforeEach(async () => {
  cwd = process.cwd();
  tmp = await mkdtemp(join(tmpdir(), 'taskman-resolve-'));
  chdir(tmp);
});

afterEach(async () => {
  chdir(cwd);
  await rm(tmp, { recursive: true, force: true });
});

describe('normalizePlanName', () => {
  test('strips .plans/ prefix and trailing slash', () => {
    expect(normalizePlanName('.plans/my-plan/')).toBe('my-plan');
  });
});

describe('resolvePlanByName', () => {
  test('resolves the sole in-progress plan with no hint', async () => {
    await makePlan('only');
    const r = await run(resolvePlanByName());
    expect(r.planName).toBe('only');
    expect(r.planDir).toBe('.plans/only');
  });

  test('ambiguous when multiple in-progress and no hint', async () => {
    await makePlan('a');
    await makePlan('b');
    const r = await run(resolvePlanByName());
    expect(r.planName).toBeUndefined();
    expect(r.candidates.sort()).toEqual(['a', 'b']);
  });

  test('explicit hint wins, accepts .plans/ prefix', async () => {
    await makePlan('a');
    await makePlan('b');
    const r = await run(resolvePlanByName({ name: '.plans/b' }));
    expect(r.planName).toBe('b');
  });

  test('missing hint returns candidates', async () => {
    await makePlan('a');
    const r = await run(resolvePlanByName({ name: 'nope' }));
    expect(r.planName).toBeUndefined();
    expect(r.candidates).toEqual(['a']);
  });
});

describe('loadPlanData', () => {
  test('builds plan data including handoff', async () => {
    await makePlan('p');
    await run(saveHandoff('.plans/p', '# Handoff'));
    const data = await run(loadPlanData('.plans/p'));
    expect(data?.planName).toBe('p');
    expect(data?.title).toBe('Title p');
    expect(data?.handoff).toBe('# Handoff');
    expect(data?.tasks).toHaveLength(1);
  });

  test('undefined when no tasks file', async () => {
    const data = await run(loadPlanData('.plans/ghost'));
    expect(data).toBeUndefined();
  });
});
