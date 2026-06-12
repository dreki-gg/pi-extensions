/**
 * Core domain model for the self-bundled stacking engine.
 *
 * A stack is an ordered chain of branches, bottom (root, based on trunk) first.
 * Each entry remembers its parent branch, its PR number, and the last known tip
 * SHA. `lastKnownTip` is essential: after a squash-merge deletes a branch we can
 * no longer `git rev-parse` it, so the remembered tip is what lets us rebase its
 * children correctly.
 */

export interface StackEntry {
  /** Branch name for this layer. */
  branch: string;
  /** Branch this layer is stacked on (its PR base). */
  parentBranch: string;
  /** GitHub PR number, when a PR exists. */
  prNumber?: number;
  /** Last observed tip SHA of `branch`, captured before mutations. */
  lastKnownTip?: string;
}

export interface Stack {
  /** Trunk branch the bottom entry targets (e.g. "main"). */
  trunk: string;
  /** Ordered bottom -> top. entries[0].parentBranch === trunk. */
  entries: StackEntry[];
}

export interface StackState {
  /** Schema version for forward-compat migrations. */
  version: number;
  stacks: Stack[];
}

export const STATE_VERSION = 1;

export function emptyState(): StackState {
  return { version: STATE_VERSION, stacks: [] };
}
