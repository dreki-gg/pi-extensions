/**
 * Undo journal: snapshot branch tips and PR bases before any mutation, so a
 * failed rebase/repair can be rolled back. Persisted at
 * `<git-dir>/pi-stack/undo.json`.
 *
 * Snapshotting also refreshes `lastKnownTip` on the live state — this is the
 * value that lets us repair children after a squash-merge deletes a branch, so
 * it MUST run before every mutating operation.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExecFn } from '../cli/runner';
import { revParse } from './git';
import { setPrBase } from './gh';
import type { Stack } from './types';

const STATE_DIR = 'pi-stack';
const UNDO_FILE = 'undo.json';

export interface UndoJournal {
  /** branch -> tip SHA at snapshot time. */
  tips: Record<string, string>;
  /** PR number -> base ref at snapshot time. */
  bases: Record<number, string>;
  /** When the snapshot was taken (ISO). */
  takenAt: string;
}

async function resolveStateDir(exec: ExecFn): Promise<string> {
  const res = await exec('git', ['rev-parse', '--absolute-git-dir']);
  const gitDir = res.code === 0 ? res.stdout.trim() : '.git';
  return join(gitDir || '.git', STATE_DIR);
}

/**
 * Capture current tips + PR bases for the given stacks. Returns the journal and
 * a tip map (branch -> sha) so callers can fold fresh tips into live state.
 */
export async function snapshot(
  exec: ExecFn,
  stacks: Stack[],
): Promise<{ journal: UndoJournal; tips: Map<string, string> }> {
  const tips = new Map<string, string>();
  const bases: Record<number, string> = {};

  for (const stack of stacks) {
    for (const entry of stack.entries) {
      const sha = await revParse(exec, entry.branch);
      if (sha) tips.set(entry.branch, sha);
      if (entry.prNumber !== undefined) bases[entry.prNumber] = entry.parentBranch;
    }
  }

  const journal: UndoJournal = {
    tips: Object.fromEntries(tips),
    bases,
    takenAt: new Date().toISOString(),
  };

  const dir = await resolveStateDir(exec);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, UNDO_FILE), `${JSON.stringify(journal, null, 2)}\n`, 'utf8');

  return { journal, tips };
}

/** Read the last saved undo journal, or null when absent/corrupt. */
export async function loadJournal(exec: ExecFn): Promise<UndoJournal | null> {
  const dir = await resolveStateDir(exec);
  try {
    const raw = await readFile(join(dir, UNDO_FILE), 'utf8');
    const parsed = JSON.parse(raw) as UndoJournal;
    if (!parsed || typeof parsed !== 'object' || !parsed.tips) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Restore branch tips and PR bases from a journal. Resets each branch with
 * `git branch -f <branch> <sha>` and retargets each PR base via gh.
 * Returns the list of restore actions performed (for reporting).
 */
export async function restore(
  exec: ExecFn,
  journal: UndoJournal,
): Promise<{ ok: boolean; actions: string[]; errors: string[] }> {
  const actions: string[] = [];
  const errors: string[] = [];

  for (const [branch, sha] of Object.entries(journal.tips)) {
    const res = await exec('git', ['branch', '-f', branch, sha]);
    if (res.code === 0) actions.push(`reset ${branch} -> ${sha.slice(0, 8)}`);
    else errors.push(`failed to reset ${branch}: ${res.stderr.trim() || res.code}`);
  }

  for (const [num, base] of Object.entries(journal.bases)) {
    const ok = await setPrBase(exec, Number(num), base);
    if (ok) actions.push(`retarget #${num} -> ${base}`);
    else errors.push(`failed to retarget #${num} -> ${base}`);
  }

  return { ok: errors.length === 0, actions, errors };
}
