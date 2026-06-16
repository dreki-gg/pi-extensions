import { describe, expect, test } from 'bun:test';
import { getStackCompletions } from '../extensions/stacked-prs/completions';

describe('getStackCompletions', () => {
  test('lists every subcommand for an empty prefix', () => {
    const items = getStackCompletions('');
    expect(items!.map((i) => i.value).sort()).toEqual(
      ['merge', 'split', 'status', 'sync', 'undo'].sort(),
    );
  });

  test('filters by prefix, case-insensitively', () => {
    expect(getStackCompletions('S')!.map((i) => i.value).sort()).toEqual([
      'split',
      'status',
      'sync',
    ]);
  });

  test('every item carries a description', () => {
    for (const i of getStackCompletions('')!) expect(i.description).toBeTruthy();
  });

  test('returns null once a space was typed', () => {
    expect(getStackCompletions('split ')).toBeNull();
  });

  test('returns empty list when nothing matches', () => {
    expect(getStackCompletions('zzz')).toEqual([]);
  });
});
