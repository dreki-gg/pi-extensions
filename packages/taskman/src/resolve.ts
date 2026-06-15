/**
 * Stateless, disk-backed plan resolution.
 *
 * Unlike the pi extension's `resolve-plan.ts` (which also juggles session
 * `state`), this is pure manifest + tasks-file resolution: given an optional
 * `name` hint, return the resolved plan name or the in-progress candidates so a
 * caller (CLI, automation) can act without any session.
 *
 * Order: explicit `name` hint → the single in-progress plan in
 * `.plans/plans.jsonl`. Ambiguous (multiple in-progress, no hint) returns
 * `{ planName: undefined, candidates }`.
 */

import { Effect } from 'effect';
import { FileSystem } from './effects/filesystem.js';
import type { JsonlParseError, JsonlValidationError, MissingMetaRecord } from './errors.js';
import { readPlansManifest } from './storage/plans-manifest.js';
import { readTasksJsonl } from './storage/task-storage.js';
import { loadHandoff } from './storage/plan-storage.js';
import type { PlanData } from './types.js';

export interface ResolvedPlanName {
  /** The resolved bare plan name, when resolvable. */
  planName?: string;
  /** Plan directory (`.plans/<name>`) for the resolved plan. */
  planDir?: string;
  /** In-progress plan names, surfaced when resolution was ambiguous or missed. */
  candidates: string[];
}

type ResolveError = JsonlParseError | JsonlValidationError;

/** Normalize a plan hint (`my-plan` or `.plans/my-plan`) to a bare name. */
export function normalizePlanName(hint: string): string {
  return hint
    .replace(/^\.plans\//, '')
    .replace(/\/+$/, '')
    .trim();
}

export function resolvePlanByName(
  opts: { name?: string } = {},
): Effect.Effect<ResolvedPlanName, ResolveError, FileSystem> {
  return Effect.gen(function* () {
    const manifest = yield* readPlansManifest();

    if (opts.name) {
      const hint = normalizePlanName(opts.name);
      const match = manifest.find((entry) => entry.name === hint);
      if (match) return { planName: match.name, planDir: `.plans/${match.name}`, candidates: [] };
      const inProgress = manifest.filter((entry) => entry.status === 'in-progress');
      return { planName: undefined, candidates: inProgress.map((entry) => entry.name) };
    }

    const inProgress = manifest.filter((entry) => entry.status === 'in-progress');
    if (inProgress.length === 1) {
      const name = inProgress[0]!.name;
      return { planName: name, planDir: `.plans/${name}`, candidates: [] };
    }
    return { planName: undefined, candidates: inProgress.map((entry) => entry.name) };
  });
}

/** Build full plan data (`title, planName, handoff, tasks, base_commit`) from disk. */
export function loadPlanData(
  planDir: string,
): Effect.Effect<
  PlanData | undefined,
  JsonlParseError | JsonlValidationError | MissingMetaRecord,
  FileSystem
> {
  return Effect.gen(function* () {
    const snapshot = yield* readTasksJsonl(planDir);
    if (!snapshot) return undefined;
    const handoff = yield* loadHandoff(planDir);
    return {
      title: snapshot.meta.title,
      planName: snapshot.meta.plan_name,
      handoff: handoff ?? '',
      tasks: snapshot.tasks,
      base_commit: snapshot.meta.base_commit,
    };
  });
}
