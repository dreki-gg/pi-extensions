import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Cause, Effect, Exit, Option } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystem, nodeFileSystemService } from '../effects/filesystem.js';
import { readTasksJsonl, updateTask, writeTasksJsonl } from '../storage/task-storage.js';
import type { TaskMeta, TaskRecord } from '../types.js';

const run = <A, E>(program: Effect.Effect<A, E, FileSystem>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provideService(FileSystem, nodeFileSystemService)));

const runExit = <A, E>(program: Effect.Effect<A, E, FileSystem>) =>
  Effect.runPromiseExit(program.pipe(Effect.provideService(FileSystem, nodeFileSystemService)));

const failureTag = <A, E>(exit: Exit.Exit<A, E>): string | undefined => {
  if (!Exit.isFailure(exit)) return undefined;
  const error = Option.getOrUndefined(Cause.failureOption(exit.cause)) as
    | { _tag?: string }
    | undefined;
  return error?._tag;
};

let dir: string;
const now = '2026-05-27T12:00:00.000Z';
const meta: TaskMeta = { _type: 'meta', title: 'Plan', plan_name: 'plan', created_at: now };
const task: TaskRecord = {
  _type: 'task',
  id: 't-001',
  description: 'Do work',
  details: 'Details',
  status: 'pending',
  created_at: now,
  updated_at: now,
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-tasks-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('tasks.jsonl storage', () => {
  test('round trips meta and tasks', async () => {
    await run(writeTasksJsonl(dir, meta, [task]));
    await expect(run(readTasksJsonl(dir))).resolves.toEqual({ meta, tasks: [task] });
  });

  test('round trips base_commit on the meta record', async () => {
    const metaWithCommit: TaskMeta = { ...meta, base_commit: 'deadbeefcafe' };
    await run(writeTasksJsonl(dir, metaWithCommit, [task]));
    const result = await run(readTasksJsonl(dir));
    expect(result?.meta.base_commit).toBe('deadbeefcafe');
  });

  test('round trips tasks without details (lightweight checklist)', async () => {
    const lightweight: TaskRecord = {
      _type: 'task',
      id: 't-002',
      description: 'Quick fix',
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    await run(writeTasksJsonl(dir, meta, [lightweight]));
    const result = await run(readTasksJsonl(dir));
    expect(result?.tasks[0]?.id).toBe('t-002');
    expect(result?.tasks[0]?.details).toBeUndefined();
  });

  test('missing file returns undefined', async () => {
    await expect(run(readTasksJsonl(dir))).resolves.toBeUndefined();
  });

  test('rejects corrupt lines with JsonlParseError', async () => {
    await Bun.write(join(dir, 'tasks.jsonl'), `${JSON.stringify(meta)}\nnot-json\n`);
    expect(failureTag(await runExit(readTasksJsonl(dir)))).toBe('JsonlParseError');
  });

  test('rejects empty files with MissingMetaRecord', async () => {
    await Bun.write(join(dir, 'tasks.jsonl'), '');
    expect(failureTag(await runExit(readTasksJsonl(dir)))).toBe('MissingMetaRecord');
  });

  test('updates a task by id and rewrites the snapshot', async () => {
    await run(writeTasksJsonl(dir, meta, [task]));
    const updated = await run(updateTask(dir, 't-001', { status: 'done', notes: 'finished' }));

    expect(updated.status).toBe('done');
    expect(updated.notes).toBe('finished');
    expect((await run(readTasksJsonl(dir)))?.tasks[0]?.status).toBe('done');
  });

  test('fails with TaskNotFound for an unknown task id', async () => {
    await run(writeTasksJsonl(dir, meta, [task]));
    expect(failureTag(await runExit(updateTask(dir, 't-999', { status: 'done' })))).toBe(
      'TaskNotFound',
    );
  });
});
