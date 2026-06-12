/**
 * Squash-merge repair. When a parent PR is squash-merged and its branch
 * deleted, its children still target the (now gone) branch and contain the
 * parent's commits in their history. We retarget the child to the merged
 * branch's base (trunk) and rebase it off the parent's remembered tip onto the
 * updated base, then cascade to deeper descendants.
 *
 * This is why `lastKnownTip` exists: the deleted branch can no longer be
 * rev-parsed, so the snapshot tip is the only handle on the old base.
 */
import type { ExecFn } from '../cli/runner';
import { fetch, remoteBranchExists } from './git';
import { setPrBase, viewPr } from './gh';
import { cascadeRebase, planRebase } from './rebase';
import { restore, type UndoJournal } from './undo';
import type { Stack, StackEntry } from './types';

/** Entries whose PR is MERGED and whose branch is gone from the remote. */
export async function detectMerged(exec: ExecFn, stack: Stack): Promise<StackEntry[]> {
  const merged: StackEntry[] = [];
  for (const entry of stack.entries) {
    if (entry.prNumber === undefined) continue;
    const pr = await viewPr(exec, entry.prNumber);
    if (pr?.state !== 'MERGED') continue;
    const stillThere = await remoteBranchExists(exec, entry.branch);
    if (!stillThere) merged.push(entry);
  }
  return merged;
}

export interface RepairResult {
  ok: boolean;
  /** Stack with the merged entry removed and the child relinked. */
  stack: Stack;
  actions: string[];
  conflictBranch?: string;
  error?: string;
}

/**
 * Repair the stack after `mergedEntry` was squash-merged + deleted.
 * Requires `mergedEntry.lastKnownTip`.
 */
export async function repairAfterMerge(
  exec: ExecFn,
  stack: Stack,
  mergedEntry: StackEntry,
  journal: UndoJournal,
  remote = 'origin',
): Promise<RepairResult> {
  const actions: string[] = [];
  const newBase = mergedEntry.parentBranch;

  if (!mergedEntry.lastKnownTip) {
    return {
      ok: false,
      stack,
      actions,
      error: `Cannot repair ${mergedEntry.branch}: no recorded lastKnownTip. Run sync before the branch is deleted next time.`,
    };
  }

  await fetch(exec, remote);

  // Build the stack with the merged entry removed; relink its direct child.
  const remaining = stack.entries.filter((e) => e.branch !== mergedEntry.branch);
  const child = remaining.find((e) => e.parentBranch === mergedEntry.branch);
  const relinked: Stack = {
    trunk: stack.trunk,
    entries: remaining.map((e) =>
      e.parentBranch === mergedEntry.branch ? { ...e, parentBranch: newBase } : e,
    ),
  };

  if (!child) {
    // Nothing stacked on top — just drop the merged entry.
    actions.push(`dropped merged ${mergedEntry.branch} (no children)`);
    return { ok: true, stack: relinked, actions };
  }

  // Retarget the child PR to the merged branch's base.
  if (child.prNumber !== undefined) {
    const ok = await setPrBase(exec, child.prNumber, newBase);
    if (!ok) {
      await restore(exec, journal);
      return {
        ok: false,
        stack,
        actions,
        conflictBranch: child.branch,
        error: `Failed to retarget #${child.prNumber} to ${newBase}; rolled back.`,
      };
    }
    actions.push(`retarget #${child.prNumber} (${child.branch}) -> ${newBase}`);
  }

  // Rebase the child off the merged branch's old tip onto the updated base.
  const rebase = await exec('git', [
    'rebase',
    '--onto',
    `${remote}/${newBase}`,
    mergedEntry.lastKnownTip,
    child.branch,
  ]);
  if (rebase.code !== 0) {
    await exec('git', ['rebase', '--abort']);
    await restore(exec, journal);
    return {
      ok: false,
      stack,
      actions,
      conflictBranch: child.branch,
      error:
        `Rebase of ${child.branch} onto ${remote}/${newBase} conflicted; aborted and rolled back.\n` +
        (rebase.stderr.trim() || rebase.stdout.trim()),
    };
  }
  const push = await exec('git', ['push', '--force-with-lease', remote, child.branch]);
  if (push.code !== 0) {
    await restore(exec, journal);
    return {
      ok: false,
      stack,
      actions,
      conflictBranch: child.branch,
      error: `Force-push of ${child.branch} failed; rolled back.`,
    };
  }
  actions.push(`rebased ${child.branch} onto ${remote}/${newBase}`);

  // Cascade to deeper descendants using pre-cascade tips from the journal.
  const oldTips = new Map(Object.entries(journal.tips));
  const steps = planRebase(relinked, child.branch, oldTips);
  if (steps.length > 0) {
    const cascade = await cascadeRebase(exec, steps, journal, remote);
    if (!cascade.ok) {
      return {
        ok: false,
        stack,
        actions,
        conflictBranch: cascade.conflictBranch,
        error: cascade.error,
      };
    }
    actions.push(...cascade.rebased.map((b) => `rebased ${b}`));
  }

  return { ok: true, stack: relinked, actions };
}
