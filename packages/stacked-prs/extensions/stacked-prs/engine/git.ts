/**
 * Thin git wrappers over an injected exec function. Pure parsing helpers stay
 * separate so they can be unit-tested without a real repo.
 */
import type { ExecFn } from '../cli/runner';

/** Resolve a ref to its full SHA. Returns null when the ref is unknown. */
export async function revParse(exec: ExecFn, ref: string): Promise<string | null> {
  const res = await exec('git', ['rev-parse', '--verify', '--quiet', ref]);
  if (res.code !== 0) return null;
  const sha = res.stdout.trim();
  return sha || null;
}

/** Merge base of two refs, or null when none / on error. */
export async function mergeBase(exec: ExecFn, a: string, b: string): Promise<string | null> {
  const res = await exec('git', ['merge-base', a, b]);
  if (res.code !== 0) return null;
  return res.stdout.trim() || null;
}

/** Whether a local branch exists. */
export async function branchExists(exec: ExecFn, branch: string): Promise<boolean> {
  const res = await exec('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
  return res.code === 0 && res.stdout.trim().length > 0;
}

/** Whether a branch exists on the remote (default origin). */
export async function remoteBranchExists(
  exec: ExecFn,
  branch: string,
  remote = 'origin',
): Promise<boolean> {
  const res = await exec('git', ['ls-remote', '--heads', remote, branch]);
  return res.code === 0 && res.stdout.trim().length > 0;
}

/** Current checked-out branch, or null when detached/unknown. */
export async function currentBranch(exec: ExecFn): Promise<string | null> {
  const res = await exec('git', ['symbolic-ref', '--short', '--quiet', 'HEAD']);
  if (res.code !== 0) return null;
  return res.stdout.trim() || null;
}

/** Fetch from the remote. Returns true on success. */
export async function fetch(exec: ExecFn, remote = 'origin'): Promise<boolean> {
  const res = await exec('git', ['fetch', remote]);
  return res.code === 0;
}

/** Default trunk branch name, derived from origin/HEAD; falls back to "main". */
export async function defaultTrunk(exec: ExecFn): Promise<string> {
  const res = await exec('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (res.code === 0) {
    const ref = res.stdout.trim();
    const slash = ref.lastIndexOf('/');
    if (slash !== -1) return ref.slice(slash + 1);
    if (ref) return ref;
  }
  return 'main';
}
