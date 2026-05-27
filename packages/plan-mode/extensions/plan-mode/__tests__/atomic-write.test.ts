import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
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

    await writeFileAtomic(target, 'hello world');

    expect(await readFile(target, 'utf8')).toBe('hello world');
  });

  test('replaces existing content atomically from the caller perspective', async () => {
    const target = join(dir, 'data.txt');
    await writeFile(target, 'old');

    await writeFileAtomic(target, 'new');

    expect(await readFile(target, 'utf8')).toBe('new');
  });

  test('leaves target untouched when writing fails before rename', async () => {
    const target = join(dir, 'data.txt');
    await writeFile(target, 'original');

    await expect(writeFileAtomic(target, 'next', { mode: 0o400 })).rejects.toThrow();

    expect(await readFile(target, 'utf8')).toBe('original');
  });
});
