/**
 * Persist stack state under the repo's git dir at `<git-dir>/pi-stack/state.json`.
 *
 * Pure (de)serialization is split from IO so it can be unit-tested without a
 * filesystem. IO uses Node built-ins only (no Bun imports in shipped code).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExecFn } from '../cli/runner';
import { emptyState, STATE_VERSION, type Stack, type StackState } from './types';

const STATE_DIR = 'pi-stack';
const STATE_FILE = 'state.json';

/** Parse persisted JSON into a StackState, tolerating missing/corrupt input. */
export function deserializeState(raw: string | undefined | null): StackState {
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as Partial<StackState>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.stacks)) {
      return emptyState();
    }
    return {
      version: typeof parsed.version === 'number' ? parsed.version : STATE_VERSION,
      stacks: parsed.stacks.filter(isStack),
    };
  } catch {
    return emptyState();
  }
}

function isStack(value: unknown): value is Stack {
  if (!value || typeof value !== 'object') return false;
  const s = value as Stack;
  return typeof s.trunk === 'string' && Array.isArray(s.entries);
}

/** Serialize state to pretty JSON. */
export function serializeState(state: StackState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

/** Resolve `<git-dir>/pi-stack` for the current repo. */
async function resolveStateDir(exec: ExecFn): Promise<string> {
  const res = await exec('git', ['rev-parse', '--absolute-git-dir']);
  const gitDir = res.code === 0 ? res.stdout.trim() : '.git';
  return join(gitDir || '.git', STATE_DIR);
}

/** Load persisted state for the current repo (empty when absent/corrupt). */
export async function loadState(exec: ExecFn): Promise<StackState> {
  const dir = await resolveStateDir(exec);
  try {
    const raw = await readFile(join(dir, STATE_FILE), 'utf8');
    return deserializeState(raw);
  } catch {
    return emptyState();
  }
}

/** Persist state for the current repo, creating the directory as needed. */
export async function saveState(exec: ExecFn, state: StackState): Promise<void> {
  const dir = await resolveStateDir(exec);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, STATE_FILE), serializeState(state), 'utf8');
}
