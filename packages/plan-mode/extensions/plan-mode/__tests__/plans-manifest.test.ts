import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chdir } from 'node:process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readPlansManifest, upsertPlanEntry, writePlansManifest } from '../storage/plans-manifest.js';

const originalCwd = process.cwd();
let dir: string;

beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'plan-mode-manifest-')); chdir(dir); });
afterEach(async () => { chdir(originalCwd); await rm(dir, { recursive: true, force: true }); });

describe('plans.jsonl manifest', () => {
  test('round trips entries', async () => {
    const entry = { _type: 'plan' as const, name: 'refactor', status: 'in-progress' as const, title: 'Refactor', created_at: 'now', completed_at: null };
    await writePlansManifest([entry]);
    await expect(readPlansManifest()).resolves.toEqual([entry]);
  });

  test('upserts new entries', async () => {
    await upsertPlanEntry('new-plan', { status: 'in-progress', title: 'New Plan' });
    const entries = await readPlansManifest();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe('new-plan');
    expect(entries[0]?.title).toBe('New Plan');
  });

  test('upserts existing entries without changing created_at', async () => {
    await writePlansManifest([{ _type: 'plan', name: 'p', status: 'in-progress', title: 'Old', created_at: 'created', completed_at: null }]);
    await upsertPlanEntry('p', { status: 'done', title: 'New' });
    const [entry] = await readPlansManifest();
    expect(entry.created_at).toBe('created');
    expect(entry.status).toBe('done');
    expect(entry.completed_at).toBeString();
  });
});
