import { Effect, Either, Option } from 'effect';
import { FileSystem } from '../effects/filesystem.js';
import { JsonlParseError, JsonlValidationError, PlanWriteError } from '../errors.js';
import { decodePlanManifestEntry } from '../schema.js';
import type { PlanStatus } from '../types.js';

const MANIFEST_DIR = '.plans';
const MANIFEST_PATH = '.plans/plans.jsonl';

export interface PlanManifestEntry {
  _type: 'plan';
  name: string;
  status: PlanStatus;
  title: string;
  created_at: string;
  completed_at: string | null;
  reason?: string;
  /** Parent initiative name (kebab). Absent = standalone flat plan. */
  initiative?: string;
  /** Plan-level dependencies (plan names). Cross-initiative allowed. */
  depends_on?: string[];
}

/** A status is terminal (closed) when it is anything other than in-progress. */
export function isTerminalStatus(status: PlanStatus): boolean {
  return status !== 'in-progress';
}

type ReadError = JsonlParseError | JsonlValidationError;

export function readPlansManifest(): Effect.Effect<PlanManifestEntry[], ReadError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    // A missing or unreadable manifest is treated as "no plans".
    const maybeText = yield* Effect.option(fs.readFileString(MANIFEST_PATH));
    if (Option.isNone(maybeText)) return [];

    const entries: PlanManifestEntry[] = [];
    for (const [index, raw] of maybeText.value.split(/\r?\n/).entries()) {
      if (!raw.trim()) continue;
      const line = index + 1;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (cause) {
        return yield* Effect.fail(new JsonlParseError({ path: MANIFEST_PATH, line, cause }));
      }

      const decoded = decodePlanManifestEntry(parsed);
      if (Either.isLeft(decoded)) {
        return yield* Effect.fail(
          new JsonlValidationError({ path: MANIFEST_PATH, line, reason: decoded.left.message }),
        );
      }
      entries.push(decoded.right);
    }
    return entries;
  });
}

export function writePlansManifest(
  entries: PlanManifestEntry[],
): Effect.Effect<void, PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDir(MANIFEST_DIR);
    const content =
      entries.map((entry) => JSON.stringify(entry)).join('\n') + (entries.length ? '\n' : '');
    yield* fs.writeFileAtomic(MANIFEST_PATH, content);
  });
}

export function upsertPlanEntry(
  name: string,
  updates: {
    status: PlanStatus;
    title?: string;
    reason?: string;
    /** Parent initiative name; preserved when omitted. */
    initiative?: string;
    /** Plan-level dependencies (plan names); preserved when omitted. */
    depends_on?: string[];
  },
): Effect.Effect<void, ReadError | PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const entries = yield* readPlansManifest();
    const now = new Date().toISOString();
    const index = entries.findIndex((entry) => entry.name === name);
    const existing = index === -1 ? undefined : entries[index];
    const entry: PlanManifestEntry = {
      _type: 'plan',
      name,
      status: updates.status,
      title: updates.title ?? existing?.title ?? 'Untitled plan',
      created_at: existing?.created_at ?? now,
      // Terminal statuses record a completion timestamp; reopening clears it.
      completed_at: isTerminalStatus(updates.status) ? (existing?.completed_at ?? now) : null,
      reason: updates.reason ?? existing?.reason,
      // Membership + plan-level deps are preserved across status-only upserts.
      initiative: updates.initiative ?? existing?.initiative,
      depends_on: updates.depends_on ?? existing?.depends_on,
    };
    if (index === -1) entries.push(entry);
    else entries[index] = entry;
    yield* writePlansManifest(entries);
  });
}

/**
 * Reconcile a plan's registry status from its task state.
 *
 * The registry `status` is a PROJECTION of task state, not a parallel flag.
 * Call this wherever tasks are written so completion is never coupled to a
 * formal in-session execution run (see FEEDBACK #1). `finalizable` means every
 * active task is resolved AND no deferred follow-ups remain.
 *
 * Guard: a manually-set terminal status (`superseded` / `abandoned`) is never
 * auto-overridden — only `in-progress` ⇄ `done` is derived from tasks.
 */
export function reconcilePlanStatus(
  name: string,
  finalizable: boolean,
  title?: string,
): Effect.Effect<void, ReadError | PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const entries = yield* readPlansManifest();
    const existing = entries.find((entry) => entry.name === name);
    // Reconcile only reflects task state for KNOWN plans; never conjure an
    // entry for an unregistered plan (orphans are surfaced, not auto-created).
    if (!existing) return;
    // Do not resurrect / clobber an explicitly closed plan.
    if (existing.status === 'superseded' || existing.status === 'abandoned') return;
    const status: PlanStatus = finalizable ? 'done' : 'in-progress';
    if (existing.status === status) return; // no change
    yield* upsertPlanEntry(name, { status, title });
  });
}
