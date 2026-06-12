import { describe, expect, it } from 'bun:test';
import {
  flattenStack,
  parseStackTree,
} from '../extensions/stacked-prs/stack/parser';

describe('parseStackTree', () => {
  it('parses a linear github stack', () => {
    const out = ['● main', '└─ ● stack-a #101', '   └─ ● stack-b #102'].join('\n');
    const roots = parseStackTree(out);

    expect(roots).toHaveLength(1);
    const root = roots[0]!;
    expect(root.branch).toBe('main');
    expect(root.number).toBeUndefined();
    expect(root.depth).toBe(0);

    const a = root.children[0]!;
    expect(a.branch).toBe('stack-a');
    expect(a.number).toBe(101);
    expect(a.provider).toBe('github');
    expect(a.depth).toBe(1);

    const b = a.children[0]!;
    expect(b.branch).toBe('stack-b');
    expect(b.number).toBe(102);
    expect(b.depth).toBe(2);
  });

  it('parses gitlab MR references with !', () => {
    const out = ['● main', '└─ ● feature !55'].join('\n');
    const roots = parseStackTree(out);
    const node = roots[0]!.children[0]!;
    expect(node.number).toBe(55);
    expect(node.provider).toBe('gitlab');
  });

  it('handles branching stacks (two children at same depth)', () => {
    const out = [
      '● main',
      '├─ ● feat-a #1',
      '└─ ● feat-b #2',
    ].join('\n');
    const roots = parseStackTree(out);
    expect(roots[0]!.children).toHaveLength(2);
    expect(roots[0]!.children.map((c) => c.branch)).toEqual(['feat-a', 'feat-b']);
  });

  it('ignores non-node lines', () => {
    const out = ['Sync preview', '', '● main', '└─ ● a #1', 'Would update PRs: #1'].join('\n');
    const roots = parseStackTree(out);
    expect(roots).toHaveLength(1);
    expect(flattenStack(roots)).toHaveLength(2);
  });

  it('returns empty for output without a tree', () => {
    expect(parseStackTree('no stack here')).toEqual([]);
  });
});
