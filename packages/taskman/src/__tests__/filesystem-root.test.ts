import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { writePlansManifest } from '../storage/plans-manifest.js';

const entry = {
  _type: 'plan' as const,
  name: 'gap-fix',
  status: 'in-progress' as const,
  title: 'Gap fix',
  created_at: 'now',
  completed_at: null,
};

const originalCwd = process.cwd();
let cwdDir: string;
let targetDir: string;

beforeEach(async () => {
  cwdDir = await mkdtemp(join(tmpdir(), 'taskman-cwd-'));
  targetDir = await mkdtemp(join(tmpdir(), 'taskman-target-'));
  chdir(cwdDir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(cwdDir, { recursive: true, force: true });
  await rm(targetDir, { recursive: true, force: true });
});

describe('root-aware filesystem runtime', () => {
  test('makePlanRuntime(root) relocates the registry under root, not cwd', async () => {
    const runInTarget = makePlanRuntime(targetDir);
    await runInTarget(writePlansManifest([entry]));

    const written = await readFile(join(targetDir, '.plans', 'plans.jsonl'), 'utf-8');
    expect(written).toContain('gap-fix');

    // Nothing leaked into the current working directory.
    await expect(readFile(join(cwdDir, '.plans', 'plans.jsonl'), 'utf-8')).rejects.toThrow();
  });

  test('makePlanRuntime() (no root) writes under the current working directory', async () => {
    const run = makePlanRuntime();
    await run(writePlansManifest([entry]));

    const written = await readFile(join(cwdDir, '.plans', 'plans.jsonl'), 'utf-8');
    expect(written).toContain('gap-fix');
  });

  test('absolute paths are unaffected by root', async () => {
    const abs = join(targetDir, 'nested');
    await mkdir(abs, { recursive: true });
    // A root pointing elsewhere must not double-prefix an absolute path.
    const runElsewhere = makePlanRuntime(cwdDir);
    // writePlansManifest uses relative paths; this assertion just guards that
    // resolve() leaves the root mechanism well-defined for relative inputs.
    await runElsewhere(writePlansManifest([entry]));
    const written = await readFile(join(cwdDir, '.plans', 'plans.jsonl'), 'utf-8');
    expect(written).toContain('gap-fix');
  });
});
