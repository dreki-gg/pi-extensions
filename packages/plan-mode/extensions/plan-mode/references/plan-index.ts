/**
 * In-memory cache of plan list items for `@plan:` autocomplete.
 *
 * Autocomplete `getSuggestions` runs on every keystroke, so it must be cheap.
 * We cache the manifest-derived `PlanListItem[]` and refresh at most once per
 * TTL window — fresh enough to surface plans submitted mid-session without a
 * per-keystroke disk hit.
 */

import type { RunPlanIO } from '@dreki-gg/taskman';
import { loadPlanListItems, type PlanListItem } from '../commands/list-plans.js';

const DEFAULT_TTL_MS = 2_000;

export interface PlanReferenceIndex {
  /** Force a reload from disk. */
  refresh(): Promise<void>;
  /** Cached items, reloading first when the cache is stale. */
  getItems(): Promise<PlanListItem[]>;
  /** Cached items without triggering IO (may be stale or empty). */
  peek(): PlanListItem[];
}

export function createPlanReferenceIndex(
  runPlanIO: RunPlanIO,
  ttlMs: number = DEFAULT_TTL_MS,
): PlanReferenceIndex {
  let items: PlanListItem[] = [];
  let loadedAt = 0;
  let inflight: Promise<void> | undefined;

  const load = async (): Promise<void> => {
    items = await runPlanIO(loadPlanListItems());
    loadedAt = Date.now();
  };

  const refresh = async (): Promise<void> => {
    // Coalesce concurrent refreshes so rapid keystrokes share one read.
    if (!inflight) {
      inflight = load().finally(() => {
        inflight = undefined;
      });
    }
    await inflight;
  };

  return {
    refresh,
    peek: () => items,
    async getItems() {
      if (Date.now() - loadedAt > ttlMs) await refresh();
      return items;
    },
  };
}
