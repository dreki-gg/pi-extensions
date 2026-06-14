import { describe, expect, test } from 'bun:test';

import { jaccard, sameBug, tokenize } from '../extensions/code-reviewer/similarity';

describe('tokenize', () => {
  test('lowercases, drops short tokens and stopwords', () => {
    const tokens = tokenize('The buffer is Off-by-one at index');
    expect(tokens.has('buffer')).toBe(true);
    expect(tokens.has('index')).toBe(true);
    expect(tokens.has('the')).toBe(false);
    expect(tokens.has('is')).toBe(false);
  });
});

describe('jaccard', () => {
  test('two empty sets are identical', () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
  });
  test('disjoint sets score 0', () => {
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });
});

describe('sameBug', () => {
  const tok = (m: string) => ({ tokens: tokenize(m) });
  test('different files are never the same bug', () => {
    expect(
      sameBug({ file: 'a.ts', line: 1, ...tok('null deref') }, { file: 'b.ts', line: 1, ...tok('null deref') }),
    ).toBe(false);
  });
  test('co-located, modestly similar messages fuse', () => {
    expect(
      sameBug(
        { file: 'a.ts', line: 10, ...tok('possible null dereference of user') },
        { file: 'a.ts', line: 12, ...tok('user may be null dereference here') },
      ),
    ).toBe(true);
  });
  test('far-apart lines do not fuse', () => {
    expect(
      sameBug(
        { file: 'a.ts', line: 10, ...tok('null dereference') },
        { file: 'a.ts', line: 200, ...tok('null dereference') },
      ),
    ).toBe(false);
  });
});
