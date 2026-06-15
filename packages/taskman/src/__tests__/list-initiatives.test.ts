import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { upsertPlanEntry } from '../storage/plans-manifest.js';
import { upsertInitiativeEntry } from '../storage/initiatives-manifest.js';
import {
  filterInitiatives,
  formatInitiativeList,
  loadInitiativeListItems,
  parseInitiativeFilter,
} from '../listing/initiatives.js';

const runPlanIO = makePlanRuntime();

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-list-init-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('list-initiatives', () => {
  test('parseInitiativeFilter maps aliases', () => {
    expect(parseInitiativeFilter('done')).toBe('done');
    expect(parseInitiativeFilter('active')).toBe('in-progress');
    expect(parseInitiativeFilter('whatever')).toBe('all');
  });

  test('rolls up member-plan progress and readiness', async () => {
    await runPlanIO(upsertInitiativeEntry('big', { status: 'in-progress', title: 'Big' }));
    await runPlanIO(upsertPlanEntry('a', { status: 'done', title: 'A', initiative: 'big' }));
    await runPlanIO(
      upsertPlanEntry('b', {
        status: 'in-progress',
        title: 'B',
        initiative: 'big',
        depends_on: ['a'],
      }),
    );

    const items = await runPlanIO(loadInitiativeListItems());
    expect(items).toHaveLength(1);
    expect(items[0]?.totalPlans).toBe(2);
    expect(items[0]?.donePlans).toBe(1);
    expect(items[0]?.ready).toBe(1); // b unblocked (a done)

    const text = formatInitiativeList(items, 'all');
    expect(text).toMatch(/big — Big \[1\/2 plans, ready 1, blocked 0\]/);
  });

  test('filterInitiatives narrows by status', async () => {
    await runPlanIO(upsertInitiativeEntry('x', { status: 'in-progress', title: 'X' }));
    await runPlanIO(upsertInitiativeEntry('y', { status: 'done', title: 'Y' }));
    const items = await runPlanIO(loadInitiativeListItems());
    expect(filterInitiatives(items, 'done').map((i) => i.name)).toEqual(['y']);
  });
});
