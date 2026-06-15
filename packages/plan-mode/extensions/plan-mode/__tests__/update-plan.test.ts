import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { readPlansManifest, upsertPlanEntry } from '@dreki-gg/taskman';
import { registerUpdatePlanTool } from '../tools/update-plan.js';

const runPlanIO = makePlanRuntime();

interface CapturedTool {
  execute: (
    id: string,
    params: { plan: string; status: string; reason?: string },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(): CapturedTool {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerUpdatePlanTool>[0];
  registerUpdatePlanTool(pi, runPlanIO);
  return tool!;
}

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-update-plan-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('update_plan tool', () => {
  test('closes a plan as superseded with a reason', async () => {
    await runPlanIO(upsertPlanEntry('p', { status: 'in-progress', title: 'P' }));
    const tool = setup();
    const result = await tool.execute('c', {
      plan: 'p',
      status: 'superseded',
      reason: 'absorbed by q',
    });
    expect(result.content?.[0]?.text).toMatch(/in-progress → superseded/);
    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.status).toBe('superseded');
    expect(entry.reason).toBe('absorbed by q');
  });

  test('accepts a .plans/<name> hint', async () => {
    await runPlanIO(upsertPlanEntry('p', { status: 'in-progress', title: 'P' }));
    const tool = setup();
    await tool.execute('c', { plan: '.plans/p', status: 'abandoned', reason: 'rejected' });
    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.status).toBe('abandoned');
  });

  test('reports not_found for an unknown plan (no throw)', async () => {
    const tool = setup();
    const result = await tool.execute('c', { plan: 'ghost', status: 'done' });
    expect((result.details as { error?: string }).error).toBe('not_found');
  });
});
