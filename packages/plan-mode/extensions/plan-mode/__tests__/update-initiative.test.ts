import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '@dreki-gg/taskman';
import {
  readInitiativesManifest,
  upsertInitiativeEntry,
} from '@dreki-gg/taskman';
import { registerUpdateInitiativeTool } from '../tools/update-initiative.js';

const runPlanIO = makePlanRuntime();

interface CapturedTool {
  execute: (
    id: string,
    params: { initiative: string; status: string; reason?: string },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(): CapturedTool {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerUpdateInitiativeTool>[0];
  registerUpdateInitiativeTool(pi, runPlanIO);
  return tool!;
}

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-update-init-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('update_initiative tool', () => {
  test('closes an initiative as superseded with a reason', async () => {
    await runPlanIO(upsertInitiativeEntry('big', { status: 'in-progress', title: 'Big' }));
    const tool = setup();
    const result = await tool.execute('c', {
      initiative: 'big',
      status: 'superseded',
      reason: 'merged into mega',
    });
    expect(result.content?.[0]?.text).toMatch(/in-progress → superseded/);
    const [entry] = await runPlanIO(readInitiativesManifest());
    expect(entry.status).toBe('superseded');
    expect(entry.reason).toBe('merged into mega');
  });

  test('accepts a .plans/<name> hint', async () => {
    await runPlanIO(upsertInitiativeEntry('big', { status: 'in-progress', title: 'Big' }));
    const tool = setup();
    await tool.execute('c', { initiative: '.plans/big', status: 'abandoned', reason: 'dropped' });
    const [entry] = await runPlanIO(readInitiativesManifest());
    expect(entry.status).toBe('abandoned');
  });

  test('reports not_found for an unknown initiative (no throw)', async () => {
    const tool = setup();
    const result = await tool.execute('c', { initiative: 'ghost', status: 'done' });
    expect((result.details as { error?: string }).error).toBe('not_found');
  });
});
