import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readTasksJsonl, updateTask, writeTasksJsonl } from '../storage/task-storage.js';
import type { TaskMeta, TaskRecord } from '../types.js';

let dir: string;
const now = '2026-05-27T12:00:00.000Z';
const meta: TaskMeta = { _type: 'meta', title: 'Plan', plan_name: 'plan', created_at: now };
const task: TaskRecord = { _type: 'task', id: 't-001', description: 'Do work', details: 'Details', status: 'pending', created_at: now, updated_at: now };

beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'plan-mode-tasks-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('tasks.jsonl storage', () => {
  test('round trips meta and tasks', async () => {
    await writeTasksJsonl(dir, meta, [task]);
    await expect(readTasksJsonl(dir)).resolves.toEqual({ meta, tasks: [task] });
  });

  test('missing file returns undefined', async () => {
    await expect(readTasksJsonl(dir)).resolves.toBeUndefined();
  });

  test('rejects corrupt lines', async () => {
    await Bun.write(join(dir, 'tasks.jsonl'), `${JSON.stringify(meta)}\nnot-json\n`);
    await expect(readTasksJsonl(dir)).rejects.toThrow(/Invalid JSONL/);
  });

  test('rejects empty files', async () => {
    await Bun.write(join(dir, 'tasks.jsonl'), '');
    await expect(readTasksJsonl(dir)).rejects.toThrow(/meta/);
  });

  test('updates a task by id and rewrites the snapshot', async () => {
    await writeTasksJsonl(dir, meta, [task]);
    const updated = await updateTask(dir, 't-001', { status: 'done', notes: 'finished' });

    expect(updated.status).toBe('done');
    expect(updated.notes).toBe('finished');
    expect((await readTasksJsonl(dir))?.tasks[0]?.status).toBe('done');
  });
});
