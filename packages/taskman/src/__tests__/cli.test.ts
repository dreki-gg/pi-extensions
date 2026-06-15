import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makePlanRuntime } from '../effects/runtime.js';
import { upsertPlanEntry } from '../storage/plans-manifest.js';
import { writeTasksJsonl } from '../storage/task-storage.js';
import type { TaskMeta, TaskRecord } from '../types.js';
import { statusCommand } from '../cli/commands/status.js';
import { updateTaskCommand } from '../cli/commands/update-task.js';
import { addTaskCommand } from '../cli/commands/add-task.js';
import { listPlansCommand } from '../cli/commands/list.js';
import { CliError } from '../cli/runtime.js';

const run = makePlanRuntime();
let cwd: string;
let tmp: string;

const meta: TaskMeta = {
  _type: 'meta',
  title: 'Title p',
  plan_name: 'p',
  created_at: '2026-01-01T00:00:00.000Z',
};
const task = (id: string): TaskRecord => ({
  _type: 'task',
  id,
  description: `task ${id}`,
  status: 'pending',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

/** Capture everything written to stdout while `fn` runs. */
async function capture(fn: () => Promise<void>): Promise<string> {
  const original = process.stdout.write.bind(process.stdout);
  let out = '';
  process.stdout.write = ((chunk: string) => {
    out += chunk;
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return out;
}

beforeEach(async () => {
  cwd = process.cwd();
  tmp = await mkdtemp(join(tmpdir(), 'taskman-cli-'));
  chdir(tmp);
  await run(upsertPlanEntry('p', { status: 'in-progress', title: 'Title p' }));
  await run(writeTasksJsonl('.plans/p', meta, [task('t-001'), task('t-002')]));
});

afterEach(async () => {
  chdir(cwd);
  await rm(tmp, { recursive: true, force: true });
});

describe('status', () => {
  test('json output reports counts and task ids', async () => {
    const out = await capture(() => statusCommand({ json: true }));
    const parsed = JSON.parse(out);
    expect(parsed.plan_name).toBe('p');
    expect(parsed.total).toBe(2);
    expect(parsed.task_ids).toEqual(['t-001', 't-002']);
  });

  test('errors clearly when plan missing', async () => {
    await expect(statusCommand({ plan: 'ghost' })).rejects.toBeInstanceOf(CliError);
  });
});

describe('update-task → status', () => {
  test('marking done is reflected by status', async () => {
    await capture(() => updateTaskCommand('t-001', 'done', {}));
    const out = await capture(() => statusCommand({ json: true }));
    const parsed = JSON.parse(out);
    expect(parsed.counts.done).toBe(1);
  });

  test('rejects an invalid status', async () => {
    await expect(updateTaskCommand('t-001', 'bogus', {})).rejects.toBeInstanceOf(CliError);
  });
});

describe('add-task', () => {
  test('requires a reason', async () => {
    await expect(addTaskCommand('follow up', {})).rejects.toBeInstanceOf(CliError);
  });

  test('appends a deferred task', async () => {
    const out = await capture(() => addTaskCommand('follow up', { reason: 'gap', json: true }));
    expect(JSON.parse(out).task_id).toBe('t-003');
  });
});

describe('list', () => {
  test('json lists the plan', async () => {
    const out = await capture(() => listPlansCommand({ json: true }));
    const parsed = JSON.parse(out);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('p');
  });
});
