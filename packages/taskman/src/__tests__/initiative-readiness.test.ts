import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystem, nodeFileSystemService } from '../effects/filesystem.js';
import {
  computePlanReadiness,
  initiativeRollup,
  isInitiativeFinalizable,
  reconcileInitiativeForPlan,
  reconcileInitiativeStatus,
} from '../initiative.js';
import { upsertPlanEntry, type PlanManifestEntry } from '../storage/plans-manifest.js';
import { readInitiativesManifest, upsertInitiativeEntry } from '../storage/initiatives-manifest.js';

const run = <A, E>(program: Effect.Effect<A, E, FileSystem>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provideService(FileSystem, nodeFileSystemService)));

function plan(partial: Partial<PlanManifestEntry> & { name: string }): PlanManifestEntry {
  return {
    _type: 'plan',
    status: 'in-progress',
    title: partial.name,
    created_at: 'now',
    completed_at: null,
    ...partial,
  };
}

describe('computePlanReadiness (pure)', () => {
  test('a plan with no deps is ready', () => {
    const rows = computePlanReadiness([plan({ name: 'a' })]);
    expect(rows).toEqual([{ name: 'a', ready: true, blockedBy: [] }]);
  });

  test('a plan whose dep is done is ready; otherwise blocked', () => {
    const plans = [
      plan({ name: 'schema', status: 'done' }),
      plan({ name: 'api', depends_on: ['schema'] }),
      plan({ name: 'ui', depends_on: ['api'] }),
    ];
    const byName = new Map(computePlanReadiness(plans).map((r) => [r.name, r]));
    expect(byName.get('api')?.ready).toBe(true);
    expect(byName.get('ui')?.ready).toBe(false);
    expect(byName.get('ui')?.blockedBy).toEqual(['api']);
  });

  test('only in-progress plans are reported (done dep itself is not a row)', () => {
    const rows = computePlanReadiness([
      plan({ name: 'schema', status: 'done' }),
      plan({ name: 'api', depends_on: ['schema'] }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['api']);
  });

  test('an unknown or terminally-closed dep keeps a plan blocked', () => {
    const rows = computePlanReadiness([
      plan({ name: 'ghost-dep', status: 'abandoned' }),
      plan({ name: 'x', depends_on: ['ghost-dep', 'missing'] }),
    ]);
    const x = rows.find((r) => r.name === 'x');
    expect(x?.ready).toBe(false);
    expect(x?.blockedBy.sort()).toEqual(['ghost-dep', 'missing']);
  });
});

describe('isInitiativeFinalizable / initiativeRollup (pure)', () => {
  const plans = [
    plan({ name: 'a', initiative: 'big', status: 'done' }),
    plan({ name: 'b', initiative: 'big', status: 'in-progress', depends_on: ['a'] }),
    plan({ name: 'c', initiative: 'big', status: 'in-progress', depends_on: ['b'] }),
    plan({ name: 'solo' }), // not a member
  ];

  test('not finalizable while a member is in-progress', () => {
    expect(isInitiativeFinalizable('big', plans)).toBe(false);
  });

  test('finalizable when all members are terminal', () => {
    const allClosed = [
      plan({ name: 'a', initiative: 'big', status: 'done' }),
      plan({ name: 'b', initiative: 'big', status: 'superseded' }),
    ];
    expect(isInitiativeFinalizable('big', allClosed)).toBe(true);
  });

  test('an empty initiative is never finalizable', () => {
    expect(isInitiativeFinalizable('nope', plans)).toBe(false);
  });

  test('rollup counts members, progress, and readiness', () => {
    const r = initiativeRollup('big', plans);
    expect(r.total).toBe(3);
    expect(r.done).toBe(1);
    expect(r.inProgress).toBe(2);
    expect(r.ready).toBe(1); // b (dep a is done)
    expect(r.blocked).toBe(1); // c (dep b is in-progress)
    const b = r.members.find((m) => m.name === 'b');
    expect(b?.ready).toBe(true);
    const c = r.members.find((m) => m.name === 'c');
    expect(c?.blockedBy).toEqual(['b']);
  });
});

describe('reconcileInitiativeStatus / reconcileInitiativeForPlan (IO projection)', () => {
  const originalCwd = process.cwd();
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'plan-mode-init-proj-'));
    chdir(dir);
  });
  afterEach(async () => {
    chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  });

  test('flips an initiative to done when its last in-progress member completes', async () => {
    await run(upsertInitiativeEntry('big', { status: 'in-progress', title: 'Big' }));
    await run(upsertPlanEntry('a', { status: 'done', title: 'A', initiative: 'big' }));
    await run(upsertPlanEntry('b', { status: 'in-progress', title: 'B', initiative: 'big' }));

    await run(reconcileInitiativeStatus('big'));
    let [entry] = await run(readInitiativesManifest());
    expect(entry.status).toBe('in-progress'); // b still open

    await run(upsertPlanEntry('b', { status: 'done', title: 'B', initiative: 'big' }));
    await run(reconcileInitiativeForPlan('b'));
    [entry] = await run(readInitiativesManifest());
    expect(entry.status).toBe('done');
  });

  test('reopens a done initiative when a member goes back in-progress', async () => {
    await run(upsertInitiativeEntry('big', { status: 'done', title: 'Big' }));
    await run(upsertPlanEntry('a', { status: 'in-progress', title: 'A', initiative: 'big' }));
    await run(reconcileInitiativeStatus('big'));
    const [entry] = await run(readInitiativesManifest());
    expect(entry.status).toBe('in-progress');
  });

  test('never overrides a manually-closed (superseded) initiative', async () => {
    await run(upsertInitiativeEntry('big', { status: 'superseded', title: 'Big', reason: 'x' }));
    await run(upsertPlanEntry('a', { status: 'done', title: 'A', initiative: 'big' }));
    await run(reconcileInitiativeStatus('big'));
    const [entry] = await run(readInitiativesManifest());
    expect(entry.status).toBe('superseded');
  });

  test('reconcileInitiativeForPlan is a no-op for a standalone plan', async () => {
    await run(upsertPlanEntry('solo', { status: 'done', title: 'Solo' }));
    await run(reconcileInitiativeForPlan('solo'));
    await expect(run(readInitiativesManifest())).resolves.toEqual([]);
  });
});
