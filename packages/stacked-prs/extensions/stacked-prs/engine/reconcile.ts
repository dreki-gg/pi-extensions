/**
 * Merge freshly inferred stack structure with previously stored state, carrying
 * forward `lastKnownTip` values for branches that still exist. The tip values
 * are what let us repair children after a parent branch is squash-merged and
 * deleted, so we must not lose them when the PR graph changes shape.
 *
 * Pure function: the actual capture of fresh tips happens before mutations in
 * the rebase/repair layer; here we only carry forward what we already knew.
 */
import { STATE_VERSION, type Stack, type StackState } from './types';

export function reconcile(stored: StackState, inferred: Stack[]): StackState {
  // Index stored tips by branch for quick carry-forward.
  const storedTip = new Map<string, string>();
  for (const stack of stored.stacks) {
    for (const entry of stack.entries) {
      if (entry.lastKnownTip) storedTip.set(entry.branch, entry.lastKnownTip);
    }
  }

  const stacks: Stack[] = inferred.map((stack) => ({
    trunk: stack.trunk,
    entries: stack.entries.map((entry) => {
      const tip = storedTip.get(entry.branch);
      return tip ? { ...entry, lastKnownTip: tip } : { ...entry };
    }),
  }));

  return { version: STATE_VERSION, stacks };
}
