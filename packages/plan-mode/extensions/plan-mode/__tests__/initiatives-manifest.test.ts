import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystem, nodeFileSystemService } from '../effects/filesystem.js';
import {
  readInitiativesManifest,
  upsertInitiativeEntry,
  writeInitiativesManifest,
} from '../storage/initiatives-manifest.js';

const run = <A, E>(program: Effect.Effect<A, E, FileSystem>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provideService(FileSystem, nodeFileSystemService)));

const originalCwd = process.cwd();
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-initiatives-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('initiatives.jsonl manifest', () => {
  test('round trips entries', async () => {
    const entry = {
      _type: 'initiative' as const,
      name: 'auth-overhaul',
      status: 'in-progress' as const,
      title: 'Auth Overhaul',
      created_at: 'now',
      completed_at: null,
    };
    await run(writeInitiativesManifest([entry]));
    await expect(run(readInitiativesManifest())).resolves.toEqual([entry]);
  });

  test('missing manifest returns an empty list', async () => {
    await expect(run(readInitiativesManifest())).resolves.toEqual([]);
  });

  test('upserts new entries', async () => {
    await run(upsertInitiativeEntry('big-thing', { status: 'in-progress', title: 'Big Thing' }));
    const entries = await run(readInitiativesManifest());
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe('big-thing');
    expect(entries[0]?.title).toBe('Big Thing');
    expect(entries[0]?.completed_at).toBeNull();
  });

  test('upserts existing entries without changing created_at', async () => {
    await run(
      writeInitiativesManifest([
        {
          _type: 'initiative',
          name: 'i',
          status: 'in-progress',
          title: 'Old',
          created_at: 'created',
          completed_at: null,
        },
      ]),
    );
    await run(upsertInitiativeEntry('i', { status: 'done', title: 'New' }));
    const [entry] = await run(readInitiativesManifest());
    expect(entry.created_at).toBe('created');
    expect(entry.status).toBe('done');
    expect(entry.completed_at).toBeString();
  });

  test('records a reason for terminal statuses and clears completed_at on reopen', async () => {
    await run(upsertInitiativeEntry('i', { status: 'in-progress', title: 'I' }));
    await run(upsertInitiativeEntry('i', { status: 'superseded', reason: 'merged into j' }));
    let [entry] = await run(readInitiativesManifest());
    expect(entry.status).toBe('superseded');
    expect(entry.reason).toBe('merged into j');
    expect(entry.completed_at).toBeString();

    await run(upsertInitiativeEntry('i', { status: 'in-progress' }));
    [entry] = await run(readInitiativesManifest());
    expect(entry.status).toBe('in-progress');
    expect(entry.completed_at).toBeNull();
  });
});
