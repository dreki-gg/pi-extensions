/**
 * `@plan:` autocomplete provider — stacks on top of the built-in provider.
 *
 * Lists all plans, ranking in-progress first. Empty query keeps that ordering;
 * a non-empty query prefers exact name-prefix matches and otherwise falls back
 * to a fuzzy search over name + title.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from '@earendil-works/pi-tui';
import { fuzzyFilter } from '@earendil-works/pi-tui';
import type { PlanListItem } from '../commands/list-plans.js';
import type { PlanStatus } from '../types.js';
import { buildPlanToken, findActivePlanToken } from './tokens.js';
import type { PlanReferenceIndex } from './plan-index.js';

const MAX_SUGGESTIONS = 20;

const STATUS_ICON: Record<PlanStatus, string> = {
  'in-progress': '🔵',
  done: '✅',
  superseded: '🔄',
  abandoned: '❌',
};

const STATUS_RANK: Record<PlanStatus, number> = {
  'in-progress': 0,
  done: 1,
  superseded: 2,
  abandoned: 3,
};

/** In-progress first, then newest plans within each status group. */
function byInProgressFirst(a: PlanListItem, b: PlanListItem): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  return b.created_at.localeCompare(a.created_at);
}

export function filterPlanReferences(items: PlanListItem[], query: string): PlanListItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [...items].sort(byInProgressFirst).slice(0, MAX_SUGGESTIONS);
  }

  const prefixMatches = items
    .filter((item) => item.name.toLowerCase().startsWith(trimmed))
    .sort(byInProgressFirst);
  if (prefixMatches.length) return prefixMatches.slice(0, MAX_SUGGESTIONS);

  return fuzzyFilter(items, trimmed, (item) => `${item.name} ${item.title}`).slice(
    0,
    MAX_SUGGESTIONS,
  );
}

export function formatPlanSuggestion(item: PlanListItem): AutocompleteItem {
  const progress = item.totalTasks > 0 ? `${item.doneTasks}/${item.totalTasks} tasks` : 'no tasks';
  return {
    value: buildPlanToken(item.name),
    label: `${item.title}`,
    description: `${STATUS_ICON[item.status]} ${item.name} • ${item.status} • ${progress}`,
  };
}

export function createPlanReferenceAutocompleteProvider(
  current: AutocompleteProvider,
  index: PlanReferenceIndex,
): AutocompleteProvider {
  return {
    async getSuggestions(
      lines,
      cursorLine,
      cursorCol,
      options,
    ): Promise<AutocompleteSuggestions | null> {
      const line = lines[cursorLine] ?? '';
      const beforeCursor = line.slice(0, cursorCol);
      const active = findActivePlanToken(beforeCursor);
      if (!active) return current.getSuggestions(lines, cursorLine, cursorCol, options);

      const items = await index.getItems();
      if (options.signal.aborted) return null;

      const matches = filterPlanReferences(items, active.query);
      if (matches.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: active.token,
        items: matches.map(formatPlanSuggestion),
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      const line = lines[cursorLine] ?? '';
      const beforeCursor = line.slice(0, cursorCol);
      if (findActivePlanToken(beforeCursor)) return false;
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  };
}

export function registerPlanReferenceAutocomplete(
  ctx: ExtensionContext,
  index: PlanReferenceIndex,
): void {
  ctx.ui.addAutocompleteProvider((current) =>
    createPlanReferenceAutocompleteProvider(current, index),
  );
}
