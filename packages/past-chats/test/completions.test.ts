import { describe, expect, test } from 'bun:test';
import { getPastChatsCompletions } from '../extensions/past-chats/completions';

describe('getPastChatsCompletions', () => {
  test('lists every subcommand for an empty prefix', () => {
    expect(getPastChatsCompletions('').map((i) => i.value).sort()).toEqual([
      'add',
      'list',
      'refresh',
      'remove',
      'summarize',
    ]);
  });

  test('filters by prefix, case-insensitively', () => {
    expect(getPastChatsCompletions('RE').map((i) => i.value).sort()).toEqual(['refresh', 'remove']);
  });

  test('every item carries a description', () => {
    for (const i of getPastChatsCompletions('')!) expect(i.description).toBeTruthy();
  });

  test('returns null once a space was typed', () => {
    expect(getPastChatsCompletions('add ')).toBeNull();
  });

  test('returns empty list when nothing matches', () => {
    expect(getPastChatsCompletions('zzz')).toEqual([]);
  });
});
