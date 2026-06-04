import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { searchPastChats, type SearchHit } from './search';
import type { PastChatsRuntimeState } from './types';

const DEFAULT_LIMIT = 10;

function formatHit(hit: SearchHit, position: number): string {
  return [`${position}. ${hit.path}`, `   score ${hit.score} — ${hit.snippet}`].join('\n');
}

export function registerSearchTool(pi: ExtensionAPI, state: PastChatsRuntimeState): void {
  pi.registerTool({
    name: 'search_past_chats',
    label: 'Search Past Chats',
    description: [
      'Fuzzy-search indexed past Pi sessions (current working directory plus folders configured in',
      '.pi/past-chats.json) to find conversations relevant to a query. Returns the matching session',
      'JSONL file paths, a snippet showing why each matched, and a fuzzy score (lower is better),',
      'sorted best match first. Use the built-in read tool on a returned path to inspect the full',
      'conversation.',
    ].join(' '),
    promptSnippet:
      'Fuzzy-search past Pi sessions and get back session file paths to read for relevant prior context.',
    promptGuidelines: [
      'Use search_past_chats to find previous sessions related to the current task before asking the user to repeat context.',
      'Read a returned session JSONL path with the read tool when you need the full prior conversation.',
    ],
    parameters: Type.Object({
      query: Type.String({
        description:
          'Fuzzy search query, e.g. keywords, a feature name, or a phrase to look for across past chats.',
      }),
      limit: Type.Optional(
        Type.Number({
          description: `Maximum number of results to return (default ${DEFAULT_LIMIT}).`,
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (state.index.getItems().length === 0) {
        await state.index.refresh(state.cwd || ctx.cwd, state.folders);
      }

      const limit = params.limit && params.limit > 0 ? params.limit : DEFAULT_LIMIT;
      const hits = searchPastChats(state.index.getItems(), params.query, limit);

      if (hits.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No past chats matched: ${params.query}` }],
          details: { query: params.query, hits: [] },
        };
      }

      const text = [
        `Found ${hits.length} past chat${hits.length === 1 ? '' : 's'} matching "${params.query}". Read a path with the read tool for the full conversation.`,
        '',
        ...hits.map((hit, index) => formatHit(hit, index + 1)),
      ].join('\n');

      return {
        content: [{ type: 'text' as const, text }],
        details: { query: params.query, hits },
      };
    },
  });
}
