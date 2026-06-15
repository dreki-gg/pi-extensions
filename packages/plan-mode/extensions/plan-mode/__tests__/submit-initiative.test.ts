import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '@dreki-gg/taskman';
import { readInitiativesManifest } from '@dreki-gg/taskman';
import { registerSubmitInitiativeTool } from '../tools/submit-initiative.js';

const runPlanIO = makePlanRuntime();

interface CapturedTool {
  execute: (
    id: string,
    params: { name: string; title: string; overview: string },
  ) => Promise<{ content?: Array<{ text: string }>; details?: unknown }>;
}

function setup(): CapturedTool {
  let tool: CapturedTool | undefined;
  const pi = {
    registerTool: (config: CapturedTool) => {
      tool = config;
    },
  } as unknown as Parameters<typeof registerSubmitInitiativeTool>[0];
  registerSubmitInitiativeTool(pi, runPlanIO);
  return tool!;
}

const originalCwd = process.cwd();
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'plan-mode-submit-init-'));
  chdir(dir);
});
afterEach(async () => {
  chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('submit_initiative tool', () => {
  test('creates a registry entry + INITIATIVE.md and kebab-cases the name', async () => {
    const tool = setup();
    const result = await tool.execute('c', {
      name: 'Auth Overhaul',
      title: 'Auth Overhaul',
      overview: '# Overview\n\nBreak auth into plans.',
    });

    const [entry] = await runPlanIO(readInitiativesManifest());
    expect(entry.name).toBe('auth-overhaul');
    expect(entry.status).toBe('in-progress');

    const md = await readFile(join(dir, '.plans/auth-overhaul/INITIATIVE.md'), 'utf-8');
    expect(md).toMatch(/Break auth into plans/);
    expect(result.content?.[0]?.text).toMatch(/initiative: "auth-overhaul"/);
  });
});
