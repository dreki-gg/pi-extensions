import { describe, expect, test } from 'bun:test';
import { getContextFoldersCompletions } from '../extensions/context-folders/completions';

describe('getContextFoldersCompletions', () => {
  test('lists every subcommand for an empty prefix', () => {
    expect(getContextFoldersCompletions('').map((i) => i.value).sort()).toEqual([
      'add',
      'init',
      'list',
      'remove',
    ]);
  });

  test('filters by prefix, case-insensitively', () => {
    expect(getContextFoldersCompletions('I').map((i) => i.value)).toEqual(['init']);
  });

  test('every item carries a description', () => {
    for (const i of getContextFoldersCompletions('')!) expect(i.description).toBeTruthy();
  });

  test('returns null once a space was typed (e.g. add <path>)', () => {
    expect(getContextFoldersCompletions('add ')).toBeNull();
  });

  test('returns empty list when nothing matches', () => {
    expect(getContextFoldersCompletions('zzz')).toEqual([]);
  });
});
