/**
 * Merge orchestration: land the root PR, then repair descendants so the next
 * entry retargets to trunk and rebases cleanly.
 */
import type { ExecFn } from '../cli/runner';
import { repairAfterMerge } from './repair';
import { snapshot, type UndoJournal } from './undo';
import type { Stack } from './types';

export type MergeMethod = 'squash' | 'merge' | 'rebase';

export interface MergePlan {
  rootBranch: string;
  rootPr?: number;
  method: MergeMethod;
  descendantBranches: string[];
}

/** Describe what a merge would do without executing it. */
export function previewMerge(stack: Stack, method: MergeMethod = 'squash'): MergePlan {
  const root = stack.entries[0];
  return {
    rootBranch: root?.branch ?? '(none)',
    rootPr: root?.prNumber,
    method,
    descendantBranches: stack.entries.slice(1).map((e) => e.branch),
  };
}

export interface MergeResult {
  ok: boolean;
  stack: Stack;
  actions: string[];
  error?: string;
}

/**
 * Merge the root PR via gh, then repair the (new bottom) descendant.
 * Snapshots first so descendant repair has the root's old tip.
 */
export async function mergeRoot(
  exec: ExecFn,
  stack: Stack,
  method: MergeMethod = 'squash',
  remote = 'origin',
): Promise<MergeResult> {
  const root = stack.entries[0];
  if (!root || root.prNumber === undefined) {
    return { ok: false, stack, actions: [], error: 'No root PR to merge.' };
  }

  // Snapshot BEFORE merge so lastKnownTip for the root is captured.
  const { journal, tips } = await snapshot(exec, [stack]);
  const enriched: Stack = {
    trunk: stack.trunk,
    entries: stack.entries.map((e) => {
      const tip = tips.get(e.branch);
      return tip ? { ...e, lastKnownTip: tip } : e;
    }),
  };

  const res = await exec('gh', [
    'pr',
    'merge',
    String(root.prNumber),
    `--${method}`,
    '--delete-branch',
  ]);
  if (res.code !== 0) {
    return {
      ok: false,
      stack,
      actions: [],
      error: `gh pr merge #${root.prNumber} failed: ${res.stderr.trim() || res.code}`,
    };
  }
  const actions = [`merged #${root.prNumber} (${root.branch}) via ${method}`];

  const mergedEntry = enriched.entries[0]!;
  if (enriched.entries.length === 1) {
    return { ok: true, stack: { trunk: stack.trunk, entries: [] }, actions };
  }

  const repair = await repairAfterMerge(
    exec,
    enriched,
    mergedEntry,
    journal as UndoJournal,
    remote,
  );
  return {
    ok: repair.ok,
    stack: repair.stack,
    actions: [...actions, ...repair.actions],
    error: repair.error,
  };
}
