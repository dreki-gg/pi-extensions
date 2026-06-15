import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { saveHandoff, loadHandoff, saveInitiative } from '../storage/plan-storage.js';

const run = makePlanRuntime();
let cwd: string;
let tmp: string;

beforeEach(async () => {
  cwd = process.cwd();
  tmp = await mkdtemp(join(tmpdir(), 'taskman-planstorage-'));
  chdir(tmp);
});

afterEach(async () => {
  chdir(cwd);
  await rm(tmp, { recursive: true, force: true });
});

describe('handoff', () => {
  test('save then load round-trips', async () => {
    await run(saveHandoff('.plans/p', '# Handoff body'));
    expect(await run(loadHandoff('.plans/p'))).toBe('# Handoff body');
  });

  test('load returns undefined when missing', async () => {
    expect(await run(loadHandoff('.plans/none'))).toBeUndefined();
  });
});

describe('initiative doc', () => {
  test('writes INITIATIVE.md', async () => {
    await run(saveInitiative('.plans/init', '# Overview'));
    expect(await readFile('.plans/init/INITIATIVE.md', 'utf-8')).toBe('# Overview');
  });
});
