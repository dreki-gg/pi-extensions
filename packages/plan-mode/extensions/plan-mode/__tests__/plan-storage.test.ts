import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystem, nodeFileSystemService } from '../effects/filesystem.js';
import {
  loadHandoff,
  readAndClearExecPending,
  saveHandoff,
  writeExecPending,
} from '../storage/plan-storage.js';
import type { ExecPendingConfig } from '../types.js';

const run = <A, E>(program: Effect.Effect<A, E, FileSystem>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provideService(FileSystem, nodeFileSystemService)));

const originalCwd = process.cwd();
let dir: string;
const config: ExecPendingConfig = { model: { provider: 'anthropic', id: 'opus' }, thinking: 'low' };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-plan-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('handoff documents', () => {
  test('round trips handoff content', async () => {
    await run(saveHandoff('.plans/p', '# Handoff'));
    await expect(run(loadHandoff('.plans/p'))).resolves.toBe('# Handoff');
  });

  test('missing handoff returns undefined', async () => {
    await expect(run(loadHandoff('.plans/missing'))).resolves.toBeUndefined();
  });
});

describe('exec-pending markers', () => {
  test('writes, reads, and clears a marker', async () => {
    await run(writeExecPending('.plans/p', config));
    const first = await run(readAndClearExecPending());
    expect(first?.planDir).toBe('.plans/p');
    expect(first?.config).toEqual(config);

    // Marker is cleared after reading.
    await expect(run(readAndClearExecPending())).resolves.toBeUndefined();
  });

  test('returns undefined when .plans does not exist', async () => {
    await expect(run(readAndClearExecPending())).resolves.toBeUndefined();
  });
});
