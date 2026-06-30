import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
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
  tasks: Array<{ id: string; description: string; details?: string }>;
  initiative?: string;
  depends_on_plans?: string[];
  target?: string;
}
interface CapturedTool {
  execute: (
    id: string,
    params: SubmitParams,
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(onPlanSubmitted: () => void = () => {}): CapturedTool {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerSubmitPlanTool>[0];
  registerSubmitPlanTool(pi, runPlanIO, { onPlanSubmitted });
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

describe('submit_plan tool — precondition gate', () => {
  test('rejects a destructive task with no proof and persists nothing', async () => {
    const tool = setup();
    const res = await tool.execute(
      'c',
      baseParams({ tasks: [{ id: 't-001', description: 'Delete the `AuthProvider` export' }] }),
    );
    expect(res.content?.[0]?.text).toContain('precondition gate failed');
    expect((res.details as { rejected?: boolean }).rejected).toBe(true);
    // Nothing written to the registry.
    const entries = await runPlanIO(readPlansManifest());
    expect(entries).toHaveLength(0);
  });

  test('accepts a destructive task that carries a proof command', async () => {
    const tool = setup();
    const res = await tool.execute(
      'c',
      baseParams({
        tasks: [
          {
            id: 't-001',
            description: 'Delete the `AuthProvider` export',
            details: 'Proof: rg "AuthProvider" -l → no consumers',
          },
        ],
      }),
    );
    expect((res.details as { rejected?: boolean }).rejected).toBeUndefined();
    const entries = await runPlanIO(readPlansManifest());
    expect(entries).toHaveLength(1);
  });

  test('accepts a non-destructive task untouched', async () => {
    const tool = setup();
    await tool.execute('c', baseParams());
    const entries = await runPlanIO(readPlansManifest());
    expect(entries).toHaveLength(1);
  });
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

describe('submit_plan tool — external target', () => {
  test('files the plan into the target repo, not cwd, and does not pin session state', async () => {
    const targetDir = await mkdtemp(join(tmpdir(), 'plan-mode-target-'));
    try {
      let pinned = false;
      const tool = setup(() => {
        pinned = true;
      });

      const result = await tool.execute('c', baseParams({ target: targetDir }));

      // Plan landed in the target repo's registry.
      const targetManifest = await readFile(join(targetDir, '.plans', 'plans.jsonl'), 'utf-8');
      expect(targetManifest).toContain('auth-jwt');
      const tasks = await readFile(join(targetDir, '.plans', 'auth-jwt', 'tasks.jsonl'), 'utf-8');
      expect(tasks).toContain('t-001');

      // Nothing leaked into the current working directory.
      await expect(
        readFile(join(dir, '.plans', 'plans.jsonl'), 'utf-8'),
      ).rejects.toThrow();

      // Author-only: the active-plan callback is NOT invoked for external targets.
      expect(pinned).toBe(false);
      expect(result.content?.[0]?.text).toMatch(/filed into/);
      expect((result.details as { target?: string }).target).toBe(targetDir);
    } finally {
      await rm(targetDir, { recursive: true, force: true });
    }
  });

  test('rejects a target directory that does not exist', async () => {
    const tool = setup();
    await expect(
      tool.execute('c', baseParams({ target: join(dir, 'does-not-exist') })),
    ).rejects.toThrow(/does not exist/);
  });
});
