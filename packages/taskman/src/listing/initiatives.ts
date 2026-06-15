/**
 * Pure + Effect helpers for listing initiatives (the engine half of the pi
 * `/initiatives` command). The interactive pi handler lives in the extension.
 */

import { Effect } from 'effect';
import { FileSystem } from '../effects/filesystem.js';
import { readPlansManifest, type PlanManifestEntry } from '../storage/plans-manifest.js';
import {
  readInitiativesManifest,
  type InitiativeManifestEntry,
} from '../storage/initiatives-manifest.js';
import { initiativeRollup } from '../initiative.js';
import type { InitiativeStatus } from '../types.js';

export type StatusFilter = 'all' | InitiativeStatus;

export interface InitiativeListItem {
  name: string;
  title: string;
  status: InitiativeStatus;
  created_at: string;
  totalPlans: number;
  donePlans: number;
  ready: number;
  blocked: number;
}

export function filterInitiatives(
  items: InitiativeListItem[],
  filter: StatusFilter,
): InitiativeListItem[] {
  if (filter === 'all') return items;
  return items.filter((i) => i.status === filter);
}

const STATUS_ICON: Record<InitiativeStatus, string> = {
  'in-progress': '🔵',
  done: '✅',
  superseded: '🔄',
  abandoned: '❌',
};

export function formatInitiativeList(items: InitiativeListItem[], filter: StatusFilter): string {
  if (items.length === 0) {
    return filter === 'all'
      ? 'No initiatives found in .plans/initiatives.jsonl'
      : `No initiatives with status "${filter}"`;
  }
  const header =
    filter === 'all'
      ? `All initiatives (${items.length})`
      : `Initiatives: ${filter} (${items.length})`;
  const lines = items.map((i) => {
    const icon = STATUS_ICON[i.status];
    const progress =
      i.totalPlans > 0
        ? ` [${i.donePlans}/${i.totalPlans} plans, ready ${i.ready}, blocked ${i.blocked}]`
        : ' [no plans]';
    const date = i.created_at.slice(0, 10);
    return `  ${icon} ${i.name} — ${i.title}${progress}  (${date})`;
  });
  return `${header}\n${lines.join('\n')}`;
}

export function loadInitiativeListItems(): Effect.Effect<InitiativeListItem[], never, FileSystem> {
  return Effect.gen(function* () {
    const initiatives = yield* Effect.orElseSucceed(
      readInitiativesManifest(),
      () => [] as InitiativeManifestEntry[],
    );
    const plans = yield* Effect.orElseSucceed(readPlansManifest(), () => [] as PlanManifestEntry[]);
    return initiatives.map((entry): InitiativeListItem => {
      const r = initiativeRollup(entry.name, plans);
      return {
        name: entry.name,
        title: entry.title,
        status: entry.status,
        created_at: entry.created_at,
        totalPlans: r.total,
        donePlans: r.done,
        ready: r.ready,
        blocked: r.blocked,
      };
    });
  });
}

const FILTER_ALIASES: Record<string, StatusFilter> = {
  all: 'all',
  'in-progress': 'in-progress',
  active: 'in-progress',
  done: 'done',
  completed: 'done',
  superseded: 'superseded',
  abandoned: 'abandoned',
};

export function parseInitiativeFilter(raw: string): StatusFilter {
  for (const token of raw.toLowerCase().split(/\s+/)) {
    if (FILTER_ALIASES[token]) return FILTER_ALIASES[token];
  }
  return 'all';
}
