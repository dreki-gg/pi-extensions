import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { upsertPlanEntry, readPlansManifest } from '../storage/plans-manifest.js';
import { writeTasksJsonl, readTasksJsonl } from '../storage/task-storage.js';
import { setTaskStatus, appendDeferredTask } from '../engine.js';
import type { TaskMeta, TaskRecord } from '../types.js';

const run = makePlanRuntime();
let cwd: string;
let tmp: string;

const meta: TaskMeta = {
  _type: 'meta',
  title: 'Title p',
  plan_name: 'p',
  created_at: '2026-01-01T00:00:00.000Z',
};
const task = (id: string): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status: 'pending',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

beforeEach(async () => {
  cwd = process.cwd();
  tmp = await mkdtemp(join(tmpdir(), 'taskman-engine-'));
  chdir(tmp);
  await run(upsertPlanEntry('p', { status: 'in-progress', title: 'Title p' }));
  await run(writeTasksJsonl('.plans/p', meta, [task('t-001'), task('t-002')]));
});

afterEach(async () => {
  chdir(cwd);
  await rm(tmp, { recursive: true, force: true });
});

describe('setTaskStatus', () => {
  test('updates status + notes and persists', async () => {
    const res = await run(setTaskStatus('.plans/p', 't-001', 'done', 'shipped'));
    expect(res.task.status).toBe('done');
    expect(res.finalizable).toBe(false);
    const snap = await run(readTasksJsonl('.plans/p'));
    expect(snap?.tasks.find((t) => t.id === 't-001')?.status).toBe('done');
    expect(snap?.tasks.find((t) => t.id === 't-001')?.notes).toBe('shipped');
  });

  test('resolving all tasks marks the plan done in the registry', async () => {
    await run(setTaskStatus('.plans/p', 't-001', 'done'));
    const res = await run(setTaskStatus('.plans/p', 't-002', 'done'));
    expect(res.finalizable).toBe(true);
    const manifest = await run(readPlansManifest());
    expect(manifest.find((e) => e.name === 'p')?.status).toBe('done');
  });

  test('fails for an unknown task id', async () => {
    await expect(run(setTaskStatus('.plans/p', 't-999', 'done'))).rejects.toBeDefined();
  });
});

describe('appendDeferredTask', () => {
  test('appends a deferred discovered task with the next id', async () => {
    const t = await run(
      appendDeferredTask('.plans/p', { description: 'follow up', reason: 'noticed gap' }),
    );
    expect(t.id).toBe('t-003');
    expect(t.status).toBe('deferred');
    expect(t.origin).toBe('discovered');
    expect(t.notes).toBe('noticed gap');
    const snap = await run(readTasksJsonl('.plans/p'));
    expect(snap?.tasks).toHaveLength(3);
  });

  test('a new deferred task keeps the plan non-finalizable', async () => {
    await run(setTaskStatus('.plans/p', 't-001', 'done'));
    await run(setTaskStatus('.plans/p', 't-002', 'done'));
    await run(appendDeferredTask('.plans/p', { description: 'extra', reason: 'why' }));
    const manifest = await run(readPlansManifest());
    expect(manifest.find((e) => e.name === 'p')?.status).toBe('in-progress');
  });
});
