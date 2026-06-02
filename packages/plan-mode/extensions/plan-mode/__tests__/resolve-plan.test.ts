import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { writeTasksJsonl } from '../storage/task-storage.js';
import { upsertPlanEntry } from '../storage/plans-manifest.js';
import { saveHandoff } from '../storage/plan-storage.js';
import { PlanModeState } from '../state.js';
import { resolveActivePlan } from '../resolve-plan.js';
import type { TaskMeta, TaskRecord } from '../types.js';

const runPlanIO = makePlanRuntime();
const now = '2026-05-27T12:00:00.000Z';

const meta = (name: string): TaskMeta => ({
  _type: 'meta',
  title: `Title ${name}`,
  plan_name: name,
  created_at: now,
});
const task = (id: string): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status: 'pending',
  origin: 'plan',
  created_at: now,
  updated_at: now,
});

/** Minimal pi stub — `state.persist` only needs `appendEntry`. */
function fakePi() {
  const entries: unknown[] = [];
  return {
    pi: { appendEntry: (_t: string, d: unknown) => entries.push(d) },
    entries,
  } as unknown as {
    pi: Parameters<typeof resolveActivePlan>[1];
    entries: unknown[];
  };
}

async function seedPlan(name: string, status: 'in-progress' | 'done', ids: string[]) {
  await runPlanIO(writeTasksJsonl(`.plans/${name}`, meta(name), ids.map(task)));
  await runPlanIO(saveHandoff(`.plans/${name}`, `# Handoff ${name}`));
  await runPlanIO(upsertPlanEntry(name, { status, title: `Title ${name}` }));
}

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-resolve-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('resolveActivePlan', () => {
  test('returns the in-memory plan without touching disk', async () => {
    const state = new PlanModeState();
    state.plan = { title: 'mem', planName: 'mem', handoff: '', tasks: [task('t-001')] };
    const { pi } = fakePi();
    const result = await resolveActivePlan(state, pi, runPlanIO);
    expect(result.plan?.planName).toBe('mem');
  });

  test('auto-attaches the single in-progress plan from disk', async () => {
    await seedPlan('alpha', 'in-progress', ['t-001', 't-002']);
    const state = new PlanModeState();
    const { pi } = fakePi();

    const result = await resolveActivePlan(state, pi, runPlanIO);

    expect(result.plan?.planName).toBe('alpha');
    expect(result.plan?.tasks).toHaveLength(2);
    expect(result.plan?.handoff).toBe('# Handoff alpha');
    // Attached into state (data only — execution mode untouched).
    expect(state.planDir).toBe('.plans/alpha');
    expect(state.executing).toBe(false);
  });

  test('is ambiguous (no attach) when multiple plans are in-progress', async () => {
    await seedPlan('alpha', 'in-progress', ['t-001']);
    await seedPlan('beta', 'in-progress', ['t-001']);
    const state = new PlanModeState();
    const { pi } = fakePi();

    const result = await resolveActivePlan(state, pi, runPlanIO);

    expect(result.plan).toBeUndefined();
    expect(result.candidates.sort()).toEqual(['alpha', 'beta']);
    expect(state.plan).toBeUndefined();
  });

  test('a name hint disambiguates among multiple in-progress plans', async () => {
    await seedPlan('alpha', 'in-progress', ['t-001']);
    await seedPlan('beta', 'in-progress', ['t-001']);
    const state = new PlanModeState();
    const { pi } = fakePi();

    const result = await resolveActivePlan(state, pi, runPlanIO, { name: '.plans/beta' });

    expect(result.plan?.planName).toBe('beta');
    expect(state.planDir).toBe('.plans/beta');
  });

  test('ignores a done plan when auto-attaching', async () => {
    await seedPlan('alpha', 'done', ['t-001']);
    const state = new PlanModeState();
    const { pi } = fakePi();

    const result = await resolveActivePlan(state, pi, runPlanIO);

    expect(result.plan).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });

  test('returns no plan + no candidates when .plans is empty', async () => {
    const state = new PlanModeState();
    const { pi } = fakePi();
    const result = await resolveActivePlan(state, pi, runPlanIO);
    expect(result.plan).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });
});
