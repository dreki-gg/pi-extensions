/**
 * Pure + Effect helpers for listing plans (the engine half of the pi `/plans`
 * command). The interactive pi handler lives in the extension.
 */

import { Effect } from 'effect';
import { FileSystem } from '../effects/filesystem.js';
import { readPlansManifest, type PlanManifestEntry } from '../storage/plans-manifest.js';
import { readTasksJsonl } from '../storage/task-storage.js';
import type { PlanStatus } from '../types.js';

export type SortField = 'name' | 'date-asc' | 'date-desc' | 'tasks';
export type StatusFilter = 'all' | PlanStatus;

export interface PlanListItem {
  name: string;
  title: string;
  status: PlanStatus;
  created_at: string;
  completed_at: string | null;
  totalTasks: number;
  doneTasks: number;
  pendingTasks: number;
}

export function filterPlans(plans: PlanListItem[], filter: StatusFilter): PlanListItem[] {
  if (filter === 'all') return plans;
  return plans.filter((p) => p.status === filter);
}

export function sortPlans(plans: PlanListItem[], sort: SortField): PlanListItem[] {
  const sorted = [...plans];
  switch (sort) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'date-asc':
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
    case 'date-desc':
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    case 'tasks':
      sorted.sort((a, b) => b.totalTasks - a.totalTasks);
      break;
  }
  return sorted;
}

const STATUS_ICON: Record<PlanStatus, string> = {
  'in-progress': '🔵',
  done: '✅',
  superseded: '🔄',
  abandoned: '❌',
};

export function formatPlanList(
  plans: PlanListItem[],
  filter: StatusFilter,
  sort: SortField,
): string {
  if (plans.length === 0) {
    return filter === 'all'
      ? 'No plans found in .plans/plans.jsonl'
      : `No plans with status "${filter}"`;
  }

  const sortLabel: Record<SortField, string> = {
    name: 'name',
    'date-asc': 'oldest first',
    'date-desc': 'newest first',
    tasks: 'most tasks first',
  };

  const header =
    filter === 'all'
      ? `All plans (${plans.length}) — sorted by ${sortLabel[sort]}`
      : `Plans: ${filter} (${plans.length}) — sorted by ${sortLabel[sort]}`;

  const lines = plans.map((p) => {
    const icon = STATUS_ICON[p.status];
    const progress = p.totalTasks > 0 ? ` [${p.doneTasks}/${p.totalTasks} tasks]` : ' [no tasks]';
    const date = p.created_at.slice(0, 10);
    return `  ${icon} ${p.name} — ${p.title}${progress}  (${date})`;
  });

  return `${header}\n${lines.join('\n')}`;
}

export function loadPlanListItems(): Effect.Effect<PlanListItem[], never, FileSystem> {
  return Effect.gen(function* () {
    const manifest = yield* Effect.orElseSucceed(
      readPlansManifest(),
      () => [] as PlanManifestEntry[],
    );
    const items: PlanListItem[] = [];

    for (const entry of manifest) {
      const dir = `.plans/${entry.name}`;
      const snapshot = yield* Effect.orElseSucceed(readTasksJsonl(dir), () => undefined);
      const totalTasks = snapshot?.tasks.length ?? 0;
      const doneTasks =
        snapshot?.tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length ?? 0;
      const pendingTasks = snapshot?.tasks.filter((t) => t.status === 'pending').length ?? 0;

      items.push({
        name: entry.name,
        title: entry.title,
        status: entry.status,
        created_at: entry.created_at,
        completed_at: entry.completed_at,
        totalTasks,
        doneTasks,
        pendingTasks,
      });
    }

    return items;
  });
}

const FILTER_ALIASES: Record<string, StatusFilter> = {
  all: 'all',
  'in-progress': 'in-progress',
  pending: 'in-progress',
  active: 'in-progress',
  done: 'done',
  completed: 'done',
  superseded: 'superseded',
  abandoned: 'abandoned',
};

const SORT_ALIASES: Record<string, SortField> = {
  name: 'name',
  'date-asc': 'date-asc',
  oldest: 'date-asc',
  'date-desc': 'date-desc',
  newest: 'date-desc',
  tasks: 'tasks',
  'task-count': 'tasks',
};

export function parseListArgs(raw: string): { filter: StatusFilter; sort: SortField } {
  const tokens = raw.toLowerCase().split(/\s+/);
  let filter: StatusFilter = 'all';
  let sort: SortField = 'date-desc';

  for (const token of tokens) {
    if (FILTER_ALIASES[token]) filter = FILTER_ALIASES[token];
    else if (SORT_ALIASES[token]) sort = SORT_ALIASES[token];
  }

  return { filter, sort };
}
