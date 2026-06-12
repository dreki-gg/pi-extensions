import { describe, expect, it } from 'bun:test';
import { inferStacks } from '../extensions/stacked-prs/engine/inference';
import type { PrInfo } from '../extensions/stacked-prs/engine/gh';

function pr(number: number, head: string, base: string): PrInfo {
  return { number, headRefName: head, baseRefName: base, title: head };
}

describe('inferStacks', () => {
  it('builds a linear chain bottom-up', () => {
    const stacks = inferStacks(
      [pr(1, 'a', 'main'), pr(2, 'b', 'a'), pr(3, 'c', 'b')],
      'main',
    );
    expect(stacks).toHaveLength(1);
    const e = stacks[0]!.entries;
    expect(e.map((x) => x.branch)).toEqual(['a', 'b', 'c']);
    expect(e[0]!.parentBranch).toBe('main');
    expect(e[1]!.parentBranch).toBe('a');
    expect(e.map((x) => x.prNumber)).toEqual([1, 2, 3]);
  });

  it('treats a PR based on trunk as a root', () => {
    const stacks = inferStacks([pr(1, 'feat', 'main')], 'main');
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.entries[0]!.parentBranch).toBe('main');
  });

  it('emits one chain per leaf when a branch has multiple children', () => {
    const stacks = inferStacks(
      [pr(1, 'a', 'main'), pr(2, 'b', 'a'), pr(3, 'c', 'a')],
      'main',
    );
    expect(stacks).toHaveLength(2);
    const branchSets = stacks.map((s) => s.entries.map((e) => e.branch));
    expect(branchSets).toContainEqual(['a', 'b']);
    expect(branchSets).toContainEqual(['a', 'c']);
  });

  it('treats a PR based on a branch with no open PR as a root', () => {
    const stacks = inferStacks([pr(2, 'b', 'deleted-parent')], 'main');
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.entries[0]!.branch).toBe('b');
    expect(stacks[0]!.entries[0]!.parentBranch).toBe('main');
  });

  it('returns empty for no PRs', () => {
    expect(inferStacks([], 'main')).toEqual([]);
  });
});
