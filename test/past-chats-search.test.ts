import { describe, expect, test } from 'bun:test';
import type { SessionInfo } from '@earendil-works/pi-coding-agent';
import type { PastChatItem } from '../packages/past-chats/extensions/past-chats/types';

function sessionInfo(partial: Partial<SessionInfo> & { path: string }): SessionInfo {
  const now = new Date('2026-05-29T10:00:00.000Z');
  return {
    id: partial.id ?? partial.path,
    path: partial.path,
    cwd: partial.cwd ?? '/repo/current',
    name: partial.name,
    parentSessionPath: partial.parentSessionPath,
    created: partial.created ?? now,
    modified: partial.modified ?? now,
    messageCount: partial.messageCount ?? 2,
    firstMessage: partial.firstMessage ?? 'First prompt',
    allMessagesText: partial.allMessagesText ?? partial.firstMessage ?? 'First prompt',
  };
}

function item(partial: {
  id: string;
  path: string;
  title: string;
  firstMessage?: string;
  allMessagesText?: string;
}): PastChatItem {
  const session = sessionInfo({
    path: partial.path,
    firstMessage: partial.firstMessage,
    allMessagesText: partial.allMessagesText ?? partial.firstMessage,
  });
  const searchableText = [partial.title, session.firstMessage, session.allMessagesText]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return {
    id: partial.id,
    token: `@session:${partial.id}`,
    aliases: [`@session:${partial.id}`, `@chat:${partial.id}`],
    session,
    title: partial.title,
    source: { cwd: session.cwd, label: 'Current', current: true },
    searchableText,
  };
}

const items: PastChatItem[] = [
  item({
    id: 'aaa',
    path: '/repo/.pi/sessions/auth.jsonl',
    title: 'Add authentication middleware',
    firstMessage: 'We need to add JWT authentication middleware to the API.',
  }),
  item({
    id: 'bbb',
    path: '/repo/.pi/sessions/payments.jsonl',
    title: 'Stripe payments integration',
    firstMessage: 'Wire up Stripe checkout for the billing page.',
  }),
  item({
    id: 'ccc',
    path: '/repo/.pi/sessions/db.jsonl',
    title: 'Database migration plan',
    firstMessage: 'Plan the Postgres schema migration for users table.',
  }),
];

describe('searchPastChats', () => {
  test('returns the best matching session path first', async () => {
    const { searchPastChats } = await import('../packages/past-chats/extensions/past-chats/search');
    const hits = searchPastChats(items, 'authentication middleware');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toBe('/repo/.pi/sessions/auth.jsonl');
  });

  test('every hit includes a path, a numeric score, and a snippet', async () => {
    const { searchPastChats } = await import('../packages/past-chats/extensions/past-chats/search');
    const hits = searchPastChats(items, 'stripe');
    expect(hits.length).toBeGreaterThan(0);
    const hit = hits[0]!;
    expect(hit.path).toBe('/repo/.pi/sessions/payments.jsonl');
    expect(typeof hit.score).toBe('number');
    expect(hit.snippet.toLowerCase()).toContain('stripe');
  });

  test('respects the limit', async () => {
    const { searchPastChats } = await import('../packages/past-chats/extensions/past-chats/search');
    const hits = searchPastChats(items, 'a', 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  test('empty or whitespace query returns no hits', async () => {
    const { searchPastChats } = await import('../packages/past-chats/extensions/past-chats/search');
    expect(searchPastChats(items, '')).toEqual([]);
    expect(searchPastChats(items, '   ')).toEqual([]);
  });

  test('non-matching query returns no hits', async () => {
    const { searchPastChats } = await import('../packages/past-chats/extensions/past-chats/search');
    expect(searchPastChats(items, 'zzzqqwxyk')).toEqual([]);
  });
});
