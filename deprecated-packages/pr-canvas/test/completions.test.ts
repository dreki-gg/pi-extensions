import { describe, expect, test } from 'bun:test';
import { getPrCanvasCompletions } from '../extensions/pr-canvas/completions';

describe('getPrCanvasCompletions', () => {
  test('lists every subcommand for an empty prefix', () => {
    expect(getPrCanvasCompletions('').map((i) => i.value).sort()).toEqual([
      'open',
      'start',
      'status',
      'stop',
    ]);
  });

  test('filters by prefix, case-insensitively', () => {
    expect(getPrCanvasCompletions('STO').map((i) => i.value).sort()).toEqual(['stop']);
  });

  test('every item carries a description', () => {
    for (const i of getPrCanvasCompletions('')!) expect(i.description).toBeTruthy();
  });

  test('returns null once a space was typed (e.g. open <number>)', () => {
    expect(getPrCanvasCompletions('open ')).toBeNull();
  });

  test('returns empty list when nothing matches', () => {
    expect(getPrCanvasCompletions('zzz')).toEqual([]);
  });
});
