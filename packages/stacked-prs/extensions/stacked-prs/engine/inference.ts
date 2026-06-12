/**
 * Infer stacks from open PRs by following each PR's base branch.
 *
 * A PR based on trunk is a stack root. A PR based on another PR's head branch is
 * a child of that PR. We walk from each root upward, emitting an ordered chain
 * (bottom -> top). When a branch has multiple children we emit one chain per
 * leaf, sharing the lower portion — adequate for v1.
 */
import type { PrInfo } from './gh';
import type { Stack, StackEntry } from './types';

export function inferStacks(prs: PrInfo[], trunk: string): Stack[] {
  // Index PRs by their head branch (the branch the PR introduces).
  const byHead = new Map<string, PrInfo>();
  for (const pr of prs) byHead.set(pr.headRefName, pr);

  // children[parentBranch] = PRs based on that branch.
  const children = new Map<string, PrInfo[]>();
  const roots: PrInfo[] = [];
  for (const pr of prs) {
    if (pr.baseRefName === trunk || !byHead.has(pr.baseRefName)) {
      // Based on trunk (or on a branch with no open PR) => treat as a root.
      roots.push(pr);
    } else {
      const list = children.get(pr.baseRefName) ?? [];
      list.push(pr);
      children.set(pr.baseRefName, list);
    }
  }

  const stacks: Stack[] = [];

  // Walk each root to every leaf, producing a chain per leaf path.
  for (const root of roots) {
    walk(root, [], trunk);
  }

  function walk(pr: PrInfo, prefix: StackEntry[], trunkRef: string) {
    const entry: StackEntry = {
      branch: pr.headRefName,
      parentBranch: prefix.length === 0 ? trunkRef : prefix[prefix.length - 1]!.branch,
      prNumber: pr.number,
    };
    const chain = [...prefix, entry];
    const kids = children.get(pr.headRefName) ?? [];
    if (kids.length === 0) {
      stacks.push({ trunk: trunkRef, entries: chain });
      return;
    }
    for (const kid of kids) walk(kid, chain, trunkRef);
  }

  return stacks;
}
