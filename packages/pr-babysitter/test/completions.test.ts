import { describe, expect, test } from 'bun:test';
import { getBabysitCompletions } from '../extensions/pr-babysitter/completions';

describe('getBabysitCompletions', () => {
  test('lists every subcommand for an empty prefix', () => {
    expect(getBabysitCompletions('')!.map((i) => i.value).sort()).toEqual([
      'start',
      'status',
      'stop',
    ]);
  });

  test('filters by prefix, case-insensitively', () => {
    expect(getBabysitCompletions('ST')!.map((i) => i.value).sort()).toEqual([
      'start',
      'status',
      'stop',
    ]);
    expect(getBabysitCompletions('sta')!.map((i) => i.value).sort()).toEqual(['start', 'status']);
  });

  test('every item carries a description', () => {
    for (const i of getBabysitCompletions('')!) expect(i.description).toBeTruthy();
  });

  test('returns null once a space was typed', () => {
    expect(getBabysitCompletions('start ')).toBeNull();
  });

  test('returns empty list when nothing matches', () => {
    expect(getBabysitCompletions('zzz')).toEqual([]);
  });
});
