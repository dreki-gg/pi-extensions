import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystem, nodeFileSystemService } from '@dreki-gg/taskman';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { upsertPlanEntry } from '@dreki-gg/taskman';
import { upsertInitiativeEntry } from '@dreki-gg/taskman';
import { writeTasksJsonl } from '@dreki-gg/taskman';
import type { TaskRecord } from '../types.js';
import { registerInitiativeStatusTool } from '../tools/initiative-status.js';

const runPlanIO = makePlanRuntime();
const run = <A, E>(program: Effect.Effect<A, E, FileSystem>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provideService(FileSystem, nodeFileSystemService)));

interface CapturedTool {
  execute: (
    id: string,
    params: { initiative?: string },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(): CapturedTool {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerInitiativeStatusTool>[0];
  registerInitiativeStatusTool(pi, runPlanIO);
  return tool!;
}

function task(id: string, status: TaskRecord['status']): TaskRecord {
  return { _type: 'task', id, description: id, status, created_at: 'n', updated_at: 'n' };
}

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-init-status-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('initiative_status tool', () => {
  async function seed() {
    await runPlanIO(upsertInitiativeEntry('big', { status: 'in-progress', title: 'Big' }));
    await runPlanIO(upsertPlanEntry('schema', { status: 'done', title: 'Schema', initiative: 'big' }));
    await runPlanIO(
      upsertPlanEntry('api', { status: 'in-progress', title: 'API', initiative: 'big', depends_on: ['schema'] }),
    );
    await runPlanIO(
      upsertPlanEntry('ui', { status: 'in-progress', title: 'UI', initiative: 'big', depends_on: ['api'] }),
    );
    await run(
      writeTasksJsonl(
        '.plans/api',
        { _type: 'meta', title: 'API', plan_name: 'api', created_at: 'n' },
        [task('t-001', 'done'), task('t-002', 'pending')],
      ),
    );
  }

  test('renders member plans with progress + ready/blocked', async () => {
    await seed();
    const result = await setup().execute('c', { initiative: 'big' });
    const text = result.content?.[0]?.text ?? '';
    expect(text).toMatch(/Initiative: Big \(big\) — in-progress/);
    expect(text).toMatch(/api \[in-progress\] 1\/2 tasks  \[ready\]/);
    expect(text).toMatch(/ui \[in-progress\].*\[blocked by api\]/);
    const details = result.details as { ready_plans?: string[] };
    expect(details.ready_plans).toContain('api');
  });

  test('auto-selects the sole in-progress initiative when none is passed', async () => {
    await seed();
    const result = await setup().execute('c', {});
    expect((result.details as { active?: boolean }).active).toBe(true);
  });

  test('reports not_found for an unknown initiative', async () => {
    await seed();
    const result = await setup().execute('c', { initiative: 'ghost' });
    expect((result.details as { error?: string }).error).toBe('not_found');
  });

  test('no in-progress initiative → inactive snapshot', async () => {
    const result = await setup().execute('c', {});
    expect((result.details as { active?: boolean }).active).toBe(false);
  });
});
