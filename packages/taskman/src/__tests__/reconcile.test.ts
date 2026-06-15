import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { writeTasksJsonl } from '../storage/task-storage.js';
import {
  readPlansManifest,
  upsertPlanEntry,
  writePlansManifest,
} from '../storage/plans-manifest.js';
import { upsertInitiativeEntry, readInitiativesManifest } from '../storage/initiatives-manifest.js';
import {
  applyInitiativeReconcile,
  applyReconcile,
  collectInitiativeDrift,
  collectPlanDrift,
} from '../reconcile.js';
import type { TaskMeta, TaskRecord, TaskStatus } from '../types.js';

const runPlanIO = makePlanRuntime();
const now = '2026-05-27T12:00:00.000Z';

const meta = (name: string): TaskMeta => ({
  _type: 'meta',
  title: `Title ${name}`,
  plan_name: name,
  created_at: now,
});
const task = (id: string, status: TaskStatus = 'pending'): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status,
  origin: 'plan',
  created_at: now,
  updated_at: now,
});

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-reconcile-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('collectPlanDrift', () => {
  test('flags a fully-done plan still registered in-progress as status drift', async () => {
    await runPlanIO(writeTasksJsonl('.plans/alpha', meta('alpha'), [task('t-001', 'done')]));
    await runPlanIO(upsertPlanEntry('alpha', { status: 'in-progress', title: 'Title alpha' }));

    const rows = await runPlanIO(collectPlanDrift());
    const alpha = rows.find((r) => r.name === 'alpha')!;
    expect(alpha.drift).toBe('status');
    expect(alpha.derivedStatus).toBe('done');
    expect(alpha.resolved).toBe(1);
    expect(alpha.total).toBe(1);
  });

  test('reports an in-sync plan with no drift', async () => {
    await runPlanIO(writeTasksJsonl('.plans/beta', meta('beta'), [task('t-001', 'pending')]));
    await runPlanIO(upsertPlanEntry('beta', { status: 'in-progress', title: 'Title beta' }));

    const rows = await runPlanIO(collectPlanDrift());
    expect(rows.find((r) => r.name === 'beta')!.drift).toBeUndefined();
  });

  test('flags registry-only plans (no tasks.jsonl)', async () => {
    await runPlanIO(upsertPlanEntry('ghost', { status: 'in-progress', title: 'Ghost' }));
    const rows = await runPlanIO(collectPlanDrift());
    const ghost = rows.find((r) => r.name === 'ghost')!;
    expect(ghost.drift).toBe('registry-only');
    expect(ghost.hasTasks).toBe(false);
  });

  test('flags orphan task dirs (tasks.jsonl, no registry entry)', async () => {
    await runPlanIO(writeTasksJsonl('.plans/orphan', meta('orphan'), [task('t-001', 'done')]));
    const rows = await runPlanIO(collectPlanDrift());
    const orphan = rows.find((r) => r.name === 'orphan')!;
    expect(orphan.drift).toBe('orphan');
  });

  test('never flags a manually-closed terminal status as drift', async () => {
    await runPlanIO(writeTasksJsonl('.plans/sup', meta('sup'), [task('t-001', 'pending')]));
    await runPlanIO(
      writePlansManifest([
        {
          _type: 'plan',
          name: 'sup',
          status: 'superseded',
          title: 'Title sup',
          created_at: now,
          completed_at: now,
          reason: 'absorbed',
        },
      ]),
    );
    const rows = await runPlanIO(collectPlanDrift());
    expect(rows.find((r) => r.name === 'sup')!.drift).toBeUndefined();
  });
});

describe('applyReconcile', () => {
  test('repairs only status drift and projects derived status into the registry', async () => {
    await runPlanIO(writeTasksJsonl('.plans/alpha', meta('alpha'), [task('t-001', 'done')]));
    await runPlanIO(upsertPlanEntry('alpha', { status: 'in-progress', title: 'Title alpha' }));

    const rows = await runPlanIO(collectPlanDrift());
    const repaired = await runPlanIO(applyReconcile(rows));
    expect(repaired.map((r) => r.name)).toEqual(['alpha']);

    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.status).toBe('done');
  });

  test('classifies an upgrade (in-progress registry, done tasks) as direction:upgrade', async () => {
    await runPlanIO(writeTasksJsonl('.plans/up', meta('up'), [task('t-001', 'done')]));
    await runPlanIO(upsertPlanEntry('up', { status: 'in-progress', title: 'Up' }));
    const rows = await runPlanIO(collectPlanDrift());
    expect(rows.find((r) => r.name === 'up')!.direction).toBe('upgrade');
  });

  test('a done plan with incomplete tasks is flagged downgrade and NOT auto-repaired', async () => {
    // Work merged but tasks never marked done: registry done, tasks in-progress.
    await runPlanIO(writeTasksJsonl('.plans/merged', meta('merged'), [task('t-001', 'pending')]));
    await runPlanIO(
      writePlansManifest([
        {
          _type: 'plan',
          name: 'merged',
          status: 'done',
          title: 'Merged',
          created_at: now,
          completed_at: now,
        },
      ]),
    );

    const rows = await runPlanIO(collectPlanDrift());
    const merged = rows.find((r) => r.name === 'merged')!;
    expect(merged.drift).toBe('status');
    expect(merged.direction).toBe('downgrade');

    // --apply must NOT regress it back to in-progress.
    const repaired = await runPlanIO(applyReconcile(rows));
    expect(repaired.map((r) => r.name)).not.toContain('merged');
    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.status).toBe('done');
  });
});

describe('initiative drift', () => {
  test('flags an initiative whose members are all closed but registry is in-progress', async () => {
    await runPlanIO(upsertInitiativeEntry('big', { status: 'in-progress', title: 'Big' }));
    await runPlanIO(upsertPlanEntry('a', { status: 'done', title: 'A', initiative: 'big' }));
    await runPlanIO(upsertPlanEntry('b', { status: 'done', title: 'B', initiative: 'big' }));

    const rows = await runPlanIO(collectInitiativeDrift());
    const big = rows.find((r) => r.name === 'big')!;
    expect(big.drift).toBe('status');
    expect(big.derivedStatus).toBe('done');
    expect(big.members).toBe(2);
  });

  test('applyInitiativeReconcile repairs initiative status drift', async () => {
    await runPlanIO(upsertInitiativeEntry('big', { status: 'in-progress', title: 'Big' }));
    await runPlanIO(upsertPlanEntry('a', { status: 'done', title: 'A', initiative: 'big' }));

    const repaired = await runPlanIO(
      applyInitiativeReconcile(await runPlanIO(collectInitiativeDrift())),
    );
    expect(repaired.map((r) => r.name)).toEqual(['big']);
    const [entry] = await runPlanIO(readInitiativesManifest());
    expect(entry.status).toBe('done');
  });

  test('never flags a manually-closed (abandoned) initiative as drift', async () => {
    await runPlanIO(
      upsertInitiativeEntry('big', { status: 'abandoned', title: 'Big', reason: 'x' }),
    );
    await runPlanIO(upsertPlanEntry('a', { status: 'done', title: 'A', initiative: 'big' }));
    const rows = await runPlanIO(collectInitiativeDrift());
    expect(rows.find((r) => r.name === 'big')!.drift).toBeUndefined();
  });
});
