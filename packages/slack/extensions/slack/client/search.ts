import { Effect } from 'effect';
import { slackGet } from './http.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchMatch {
  channel: { id: string; name: string };
  user: string;
  text: string;
  ts: string;
  permalink: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  total: number;
  cursor?: string;
}

// ---------------------------------------------------------------------------
// Raw Slack shapes
// ---------------------------------------------------------------------------

interface RawSearchMatch {
  channel: { id: string; name: string };
  username?: string;
  user?: string;
  text: string;
  ts: string;
  permalink: string;
}

// ---------------------------------------------------------------------------
// Effect
// ---------------------------------------------------------------------------

export function searchMessages(params: {
  query: string;
  count?: number;
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
  cursor?: string;
}) {
  return Effect.gen(function* () {
    const resp = yield* slackGet<{
      ok: true;
      messages: {
        matches: RawSearchMatch[];
        total: number;
        pagination?: { next_cursor?: string };
      };
    }>(
      'search.messages',
      {
        query: params.query,
        count: params.count ?? 20,
        sort: params.sort ?? 'timestamp',
        sort_dir: params.sortDir ?? 'desc',
        cursor: params.cursor,
      },
      { useUserToken: true },
    );

    return {
      matches: resp.messages.matches.map((m) => ({
        channel: m.channel,
        user: m.username ?? m.user ?? 'unknown',
        text: m.text,
        ts: m.ts,
        permalink: m.permalink,
      })),
      total: resp.messages.total,
      cursor: resp.messages.pagination?.next_cursor || undefined,
    } satisfies SearchResult;
  });
}
