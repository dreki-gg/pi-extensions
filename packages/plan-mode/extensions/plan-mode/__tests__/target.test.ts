import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { resolvePlanTarget } from '../target.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-target-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolvePlanTarget', () => {
  test('returns undefined for absent / empty / whitespace input', async () => {
    expect(await resolvePlanTarget(undefined)).toBeUndefined();
    expect(await resolvePlanTarget('')).toBeUndefined();
    expect(await resolvePlanTarget('   ')).toBeUndefined();
  });

  test('resolves an existing absolute directory', async () => {
    expect(await resolvePlanTarget(dir)).toBe(dir);
  });

  test('resolves a relative path against cwd', async () => {
    const rel = relative(process.cwd(), dir);
    expect(await resolvePlanTarget(rel)).toBe(dir);
  });

  test('expands a leading ~ to the home directory', async () => {
    expect(await resolvePlanTarget('~')).toBe(homedir());
  });

  test('throws when the target does not exist', async () => {
    await expect(resolvePlanTarget(join(dir, 'nope'))).rejects.toThrow(/does not exist/);
  });

  test('throws when the target is a file, not a directory', async () => {
    const file = join(dir, 'file.txt');
    await writeFile(file, 'x');
    await expect(resolvePlanTarget(file)).rejects.toThrow(/not a directory/);
  });
});
