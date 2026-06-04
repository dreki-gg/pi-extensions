import { fuzzyMatch } from '@earendil-works/pi-tui';
import type { PastChatItem } from './types';

export type SearchHit = {
  path: string;
  score: number;
  snippet: string;
};

const DEFAULT_LIMIT = 10;
const SNIPPET_RADIUS = 80;
const FALLBACK_SNIPPET_CHARS = 160;

function tokenize(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function snippetSource(item: PastChatItem): string {
  return [item.title, item.session.firstMessage, item.session.allMessagesText]
    .filter(Boolean)
    .join(' \n ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSnippet(item: PastChatItem, tokens: string[]): string {
  const source = snippetSource(item);
  if (!source) return '';

  const lower = source.toLowerCase();
  let earliest = -1;
  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index !== -1 && (earliest === -1 || index < earliest)) earliest = index;
  }

  if (earliest === -1) {
    return source.length > FALLBACK_SNIPPET_CHARS
      ? `${source.slice(0, FALLBACK_SNIPPET_CHARS).trimEnd()}…`
      : source;
  }

  const start = Math.max(0, earliest - SNIPPET_RADIUS);
  const end = Math.min(source.length, earliest + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

export function searchPastChats(
  items: PastChatItem[],
  query: string,
  limit = DEFAULT_LIMIT,
): SearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored: Array<{ item: PastChatItem; score: number }> = [];
  for (const item of items) {
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const match = fuzzyMatch(token, item.searchableText);
      if (!match.matches) {
        matchedAll = false;
        break;
      }
      total += match.score;
    }
    if (matchedAll) scored.push({ item, score: total });
  }

  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, Math.max(0, limit)).map(({ item, score }) => ({
    path: item.session.path,
    score: Math.round(score * 100) / 100,
    snippet: buildSnippet(item, tokens),
  }));
}
