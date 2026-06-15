import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { readPlansManifest } from '@dreki-gg/taskman';
import {
  readInitiativesManifest,
  upsertInitiativeEntry,
} from '@dreki-gg/taskman';
import { registerSubmitPlanTool } from '../tools/submit-plan.js';

const runPlanIO = makePlanRuntime();

interface SubmitParams {
  name: string;
  title: string;
  handoff: string;
  tasks: Array<{ id: string; description: string }>;
  initiative?: string;
  depends_on_plans?: string[];
}
interface CapturedTool {
  execute: (
    id: string,
    params: SubmitParams,
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(): CapturedTool {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerSubmitPlanTool>[0];
  registerSubmitPlanTool(pi, runPlanIO, { onPlanSubmitted: () => {} });
  return tool!;
}

const baseParams = (over: Partial<SubmitParams> = {}): SubmitParams => ({
  name: 'auth-jwt',
  title: 'Auth JWT',
  handoff: '# handoff',
  tasks: [{ id: 't-001', description: 'do it' }],
  ...over,
});

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-submit-plan-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('submit_plan tool — initiative + plan deps', () => {
  test('persists initiative + depends_on onto the plan manifest entry', async () => {
    await runPlanIO(upsertInitiativeEntry('auth-overhaul', { status: 'in-progress', title: 'Auth' }));
    const tool = setup();
    await tool.execute('c', baseParams({ initiative: 'auth-overhaul', depends_on_plans: ['auth-schema'] }));

    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.initiative).toBe('auth-overhaul');
    expect(entry.depends_on).toEqual(['auth-schema']);
  });

  test('kebab-cases the initiative name and reconciles it (member keeps it in-progress)', async () => {
    await runPlanIO(upsertInitiativeEntry('auth-overhaul', { status: 'done', title: 'Auth' }));
    const tool = setup();
    await tool.execute('c', baseParams({ initiative: 'Auth Overhaul' }));

    const [plan] = await runPlanIO(readPlansManifest());
    expect(plan.initiative).toBe('auth-overhaul');
    // A fresh in-progress member must reopen a prematurely-done initiative.
    const [init] = await runPlanIO(readInitiativesManifest());
    expect(init.status).toBe('in-progress');
  });

  test('warns softly when the initiative has no registry entry yet', async () => {
    const tool = setup();
    const result = await tool.execute('c', baseParams({ initiative: 'ghost-initiative' }));
    expect(result.content?.[0]?.text).toMatch(/no initiatives\.jsonl entry yet/);
  });

  test('a standalone plan stores no initiative and no warning', async () => {
    const tool = setup();
    const result = await tool.execute('c', baseParams());
    const [entry] = await runPlanIO(readPlansManifest());
    expect(entry.initiative).toBeUndefined();
    expect(result.content?.[0]?.text).not.toMatch(/initiative/i);
  });
});
