/**
 * Cascading rebase. When a branch in a stack moves (its tip changes), every
 * descendant must be replayed onto the new tip.
 *
 * Key trick: process descendants top-down through the chain using
 * `git rebase --onto <parentBranch> <oldParentTip> <branch>`. By the time we
 * reach a deeper descendant, its parent branch ref already points at the
 * rebased tip, while `<oldParentTip>` (captured BEFORE the cascade) marks the
 * old base to replay from. This avoids needing to know post-rebase SHAs ahead
 * of time, so the plan stays pure.
 */
import type { ExecFn } from '../cli/runner';
import { restore, type UndoJournal } from './undo';
import type { Stack } from './types';

export interface RebaseStep {
  /** Branch to rebase. */
  branch: string;
  /** Ref to replay onto — the parent branch name (already updated at runtime). */
  onto: string;
  /** Old base SHA to replay from (parent's pre-cascade tip). */
  from: string;
}

export interface CascadeResult {
  ok: boolean;
  /** Branches successfully rebased + pushed, in order. */
  rebased: string[];
  /** The branch whose rebase hit a conflict, if any. */
  conflictBranch?: string;
  error?: string;
}

/**
 * Build the ordered rebase steps for every descendant of `movedBranch`.
 * `oldTips` must hold the pre-cascade tip SHAs of all parents in the chain.
 */
export function planRebase(
  stack: Stack,
  movedBranch: string,
  oldTips: Map<string, string>,
): RebaseStep[] {
  const idx = stack.entries.findIndex((e) => e.branch === movedBranch);
  if (idx === -1) return [];
  const steps: RebaseStep[] = [];
  for (let i = idx + 1; i < stack.entries.length; i++) {
    const entry = stack.entries[i]!;
    const from = oldTips.get(entry.parentBranch);
    if (!from) continue; // can't safely rebase without the old base
    steps.push({ branch: entry.branch, onto: entry.parentBranch, from });
  }
  return steps;
}

/**
 * Execute rebase steps in order, force-pushing each. On the first conflict,
 * abort the rebase and roll back via the undo journal.
 */
export async function cascadeRebase(
  exec: ExecFn,
  steps: RebaseStep[],
  journal: UndoJournal,
  remote = 'origin',
): Promise<CascadeResult> {
  const rebased: string[] = [];

  for (const step of steps) {
    const res = await exec('git', ['rebase', '--onto', step.onto, step.from, step.branch]);
    if (res.code !== 0) {
      await exec('git', ['rebase', '--abort']);
      await restore(exec, journal);
      return {
        ok: false,
        rebased,
        conflictBranch: step.branch,
        error:
          `Rebase of ${step.branch} onto ${step.onto} conflicted; aborted and rolled back.\n` +
          (res.stderr.trim() || res.stdout.trim()),
      };
    }

    const push = await exec('git', ['push', '--force-with-lease', remote, step.branch]);
    if (push.code !== 0) {
      await restore(exec, journal);
      return {
        ok: false,
        rebased,
        conflictBranch: step.branch,
        error: `Force-push of ${step.branch} failed; rolled back.\n${push.stderr.trim()}`,
      };
    }
    rebased.push(step.branch);
  }

  return { ok: true, rebased };
}
