/**
 * Drift detection + repair between `tasks.jsonl` reality and registry status.
 *
 * Drift happens in both directions (FEEDBACK #6):
 *   - tasks all done but registry `in-progress` (completion never recorded), and
 *   - registry `in-progress`/`done` disagreeing with task state generally.
 *
 * It also surfaces two un-trackable classes:
 *   - registry-only plans (an entry with no `tasks.jsonl` directory), and
 *   - orphan task dirs (a `tasks.jsonl` with no registry entry).
 *
 * `collectPlanDrift` is a pure read; `applyReconcile` repairs only the safe
 * `in-progress` ⇄ `done` projection and never touches terminal statuses.
 */

import { Effect } from 'effect';
import { FileSystem } from './effects/filesystem.js';
import type {
  JsonlParseError,
  JsonlValidationError,
  MissingMetaRecord,
  PlanWriteError,
} from './errors.js';
import { readPlansManifest, reconcilePlanStatus } from './storage/plans-manifest.js';
import { readTasksJsonl } from './storage/task-storage.js';
import { isPlanFinalizable } from './task-status.js';
import type { PlanStatus } from './types.js';

const PLANS_DIR = '.plans';

export interface PlanDriftRow {
  name: string;
  /** Registry status, or `undefined` when there is a task dir but no entry. */
  registryStatus?: PlanStatus;
  title?: string;
  /** Derived from tasks: `done` when finalizable, else `in-progress`. */
  derivedStatus?: 'in-progress' | 'done';
  /** Resolved/total task counts when a tasks.jsonl exists. */
  resolved?: number;
  total?: number;
  /** True when a `tasks.jsonl` snapshot was found for this plan. */
  hasTasks: boolean;
  /**
   * Drift class:
   *   - 'status'        : registry status disagrees with derived task status
   *   - 'registry-only' : registry entry but no tasks.jsonl dir
   *   - 'orphan'        : tasks.jsonl dir but no registry entry
   *   - undefined       : in sync
   */
  drift?: 'status' | 'registry-only' | 'orphan';
}

type CollectError = JsonlParseError | JsonlValidationError | MissingMetaRecord;

/** Walk every plan (registry + task dirs) and classify drift. Pure read. */
export function collectPlanDrift(): Effect.Effect<PlanDriftRow[], CollectError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const manifest = yield* readPlansManifest();
    const dirs = yield* Effect.orElseSucceed(fs.listDirectories(PLANS_DIR), () => [] as string[]);
    // Ignore dotfile dirs like `.archive`.
    const taskDirs = new Set(dirs.filter((name) => !name.startsWith('.')));

    const rows: PlanDriftRow[] = [];
    const seen = new Set<string>();

    for (const entry of manifest) {
      seen.add(entry.name);
      const snapshot = yield* readTasksJsonl(`${PLANS_DIR}/${entry.name}`);
      if (!snapshot) {
        rows.push({
          name: entry.name,
          registryStatus: entry.status,
          title: entry.title,
          hasTasks: false,
          drift: 'registry-only',
        });
        continue;
      }
      const total = snapshot.tasks.length;
      const resolved = snapshot.tasks.filter(
        (t) => t.status === 'done' || t.status === 'skipped',
      ).length;
      const derivedStatus = isPlanFinalizable(snapshot.tasks) ? 'done' : 'in-progress';
      // Terminal statuses (superseded/abandoned) are intentional — never drift.
      const isTerminalManual = entry.status === 'superseded' || entry.status === 'abandoned';
      const drift = !isTerminalManual && entry.status !== derivedStatus ? 'status' : undefined;
      rows.push({
        name: entry.name,
        registryStatus: entry.status,
        title: entry.title,
        derivedStatus,
        resolved,
        total,
        hasTasks: true,
        drift,
      });
    }

    // Orphan task dirs: have tasks.jsonl but no registry entry.
    for (const name of taskDirs) {
      if (seen.has(name)) continue;
      const snapshot = yield* readTasksJsonl(`${PLANS_DIR}/${name}`);
      if (!snapshot) continue;
      const total = snapshot.tasks.length;
      const resolved = snapshot.tasks.filter(
        (t) => t.status === 'done' || t.status === 'skipped',
      ).length;
      rows.push({
        name,
        title: snapshot.meta.title,
        derivedStatus: isPlanFinalizable(snapshot.tasks) ? 'done' : 'in-progress',
        resolved,
        total,
        hasTasks: true,
        drift: 'orphan',
      });
    }

    return rows;
  });
}

/**
 * Repair `status`-class drift by projecting derived status into the registry.
 * Orphans and registry-only rows are reported but not auto-fixed (they need a
 * human decision). Returns the rows that were repaired.
 */
export function applyReconcile(
  rows: PlanDriftRow[],
): Effect.Effect<PlanDriftRow[], CollectError | PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const repaired: PlanDriftRow[] = [];
    for (const row of rows) {
      if (row.drift !== 'status' || !row.derivedStatus) continue;
      yield* reconcilePlanStatus(row.name, row.derivedStatus === 'done', row.title);
      repaired.push(row);
    }
    return repaired;
  });
}
