/**
 * Minimal git helpers used by the split flow. Pure parsing logic lives here so
 * it can be unit-tested; the exec calls are thin.
 */
import type { ExecFn } from '../cli/runner';
import type { ChangedFile } from '../split/analyzer';

/** Parse `git status --porcelain` output into changed files. */
export function parsePorcelain(output: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2).trim();
    let path = line.slice(3).trim();
    // Handle rename "old -> new": keep the new path.
    const arrow = path.indexOf(' -> ');
    if (arrow !== -1) path = path.slice(arrow + 4);
    if (path) files.push({ path, status });
  }
  return files;
}

/** Count changed lines from `git diff --numstat` output (added + deleted). */
export function parseNumstat(output: string): number {
  let total = 0;
  for (const line of output.split('\n')) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const added = Number.parseInt(parts[0]!, 10);
    const deleted = Number.parseInt(parts[1]!, 10);
    if (!Number.isNaN(added)) total += added;
    if (!Number.isNaN(deleted)) total += deleted;
  }
  return total;
}

export async function changedFiles(exec: ExecFn): Promise<ChangedFile[]> {
  const res = await exec('git', ['status', '--porcelain']);
  return parsePorcelain(res.stdout);
}

export async function changedLineCount(exec: ExecFn): Promise<number> {
  const res = await exec('git', ['diff', '--numstat', 'HEAD']);
  return parseNumstat(res.stdout);
}

export async function currentTrunk(exec: ExecFn): Promise<string> {
  // Try to read the default branch from origin/HEAD; fall back to main.
  const res = await exec('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (res.code === 0) {
    const ref = res.stdout.trim();
    const slash = ref.lastIndexOf('/');
    if (slash !== -1) return ref.slice(slash + 1);
    if (ref) return ref;
  }
  return 'main';
}
