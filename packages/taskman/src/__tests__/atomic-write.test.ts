import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Effect, Exit } from 'effect';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileAtomic } from '../storage/atomic-write.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-atomic-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('writeFileAtomic', () => {
  test('writes complete content to the target path', async () => {
    const target = join(dir, 'data.txt');

    await Effect.runPromise(writeFileAtomic(target, 'hello world'));

    expect(await readFile(target, 'utf8')).toBe('hello world');
  });

  test('replaces existing content atomically from the caller perspective', async () => {
    const target = join(dir, 'data.txt');
    await writeFile(target, 'old');

    await Effect.runPromise(writeFileAtomic(target, 'new'));

    expect(await readFile(target, 'utf8')).toBe('new');
  });

  test('fails with PlanWriteError and leaves target untouched when the write fails', async () => {
    const target = join(dir, 'data.txt');
    await writeFile(target, 'original');

    const exit = await Effect.runPromiseExit(writeFileAtomic(target, 'next', { mode: 0o400 }));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(await readFile(target, 'utf8')).toBe('original');
  });
});
