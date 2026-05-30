import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { AutocompleteItem, AutocompleteProvider, AutocompleteSuggestions } from '@earendil-works/pi-tui';
import { fuzzyFilter } from '@earendil-works/pi-tui';
import type { PastChatItem, PastChatsRuntimeState } from './types';
import { buildToken, findActiveToken } from './tokens';

const MAX_SUGGESTIONS = 20;

function formatDate(date: Date): string {
  return Number.isNaN(date.getTime()) ? 'unknown date' : date.toISOString().slice(0, 10);
}

function formatSuggestion(item: PastChatItem, prefix: '@session:' | '@chat:'): AutocompleteItem {
  const first = item.session.firstMessage?.replace(/\s+/g, ' ').trim();
  const snippet = first ? ` — ${first.slice(0, 80)}` : '';
  return {
    value: buildToken(prefix, item.id),
    label: item.title,
    description: `${item.source.label} • ${formatDate(item.session.modified)} • ${item.session.messageCount} msgs${snippet}`,
  };
}

export function filterPastChats(items: PastChatItem[], query: string): PastChatItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items.slice(0, MAX_SUGGESTIONS);

  const exactIdMatches = items.filter((item) => item.id.startsWith(trimmed));
  if (exactIdMatches.length) return exactIdMatches.slice(0, MAX_SUGGESTIONS);

  return fuzzyFilter(items, trimmed, (item) => item.searchableText).slice(0, MAX_SUGGESTIONS);
}

export function createPastChatsAutocompleteProvider(
  current: AutocompleteProvider,
  state: PastChatsRuntimeState,
): AutocompleteProvider {
  return {
    async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
      const line = lines[cursorLine] ?? '';
      const beforeCursor = line.slice(0, cursorCol);
      const active = findActiveToken(beforeCursor);
      if (!active) return current.getSuggestions(lines, cursorLine, cursorCol, options);

      if (options.signal.aborted) return null;
      const matches = filterPastChats(state.index.getItems(), active.query);
      return {
        prefix: active.token,
        items: matches.map((item) => formatSuggestion(item, active.prefix)),
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      const line = lines[cursorLine] ?? '';
      const beforeCursor = line.slice(0, cursorCol);
      if (findActiveToken(beforeCursor)) return false;
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  };
}

export function registerAutocomplete(ctx: ExtensionContext, state: PastChatsRuntimeState): void {
  ctx.ui.addAutocompleteProvider((current) => createPastChatsAutocompleteProvider(current, state));
}
