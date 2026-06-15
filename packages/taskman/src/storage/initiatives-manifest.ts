/**
 * `.plans/initiatives.jsonl` registry — the initiative-level sibling of
 * `plans-manifest.ts`.
 *
 * An initiative groups multiple plans. Its `status` is a PROJECTION of its
 * member plans' statuses (see `reconcileInitiativeStatus` in `../initiative.ts`
 * for the projection wiring): `done` when every member plan is terminal,
 * `in-progress` otherwise. Manually-set terminal statuses (`superseded` /
 * `abandoned` via `update_initiative`) are never auto-overridden.
 *
 * This module is intentionally dependency-light: it knows how to read/write the
 * registry. The projection (which must read the PLANS manifest) lives in
 * `../initiative.ts` to keep the dependency direction one-way and cycle-free.
 */

import { Effect, Either, Option } from 'effect';
import { FileSystem } from '../effects/filesystem.js';
import { JsonlParseError, JsonlValidationError, PlanWriteError } from '../errors.js';
import { decodeInitiativeManifestEntry } from '../schema.js';
import type { InitiativeStatus } from '../types.js';
import { withFileLock } from './file-lock.js';

const MANIFEST_DIR = '.plans';
const MANIFEST_PATH = '.plans/initiatives.jsonl';

export interface InitiativeManifestEntry {
  _type: 'initiative';
  name: string;
  status: InitiativeStatus;
  title: string;
  created_at: string;
  completed_at: string | null;
  reason?: string;
}

/** A status is terminal (closed) when it is anything other than in-progress. */
export function isTerminalStatus(status: InitiativeStatus): boolean {
  return status !== 'in-progress';
}

type ReadError = JsonlParseError | JsonlValidationError;

export function readInitiativesManifest(): Effect.Effect<
  InitiativeManifestEntry[],
  ReadError,
  FileSystem
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    // A missing or unreadable manifest is treated as "no initiatives".
    const maybeText = yield* Effect.option(fs.readFileString(MANIFEST_PATH));
    if (Option.isNone(maybeText)) return [];

    const entries: InitiativeManifestEntry[] = [];
    for (const [index, raw] of maybeText.value.split(/\r?\n/).entries()) {
      if (!raw.trim()) continue;
      const line = index + 1;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (cause) {
        return yield* Effect.fail(new JsonlParseError({ path: MANIFEST_PATH, line, cause }));
      }

      const decoded = decodeInitiativeManifestEntry(parsed);
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

export function writeInitiativesManifest(
  entries: InitiativeManifestEntry[],
): Effect.Effect<void, PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDir(MANIFEST_DIR);
    const content =
      entries.map((entry) => JSON.stringify(entry)).join('\n') + (entries.length ? '\n' : '');
    yield* fs.writeFileAtomic(MANIFEST_PATH, content);
  });
}

export interface InitiativeUpsert {
  status: InitiativeStatus;
  title?: string;
  reason?: string;
}

/**
 * Pure transform: upsert `name` into the in-memory `entries` array, preserving
 * created_at from any existing entry. No IO — shared by the locked
 * `upsertInitiativeEntry` and `reconcileInitiativeStatus` so both flow through
 * one serialized read-modify-write and never nest locks.
 */
export function applyInitiativeUpsert(
  entries: InitiativeManifestEntry[],
  name: string,
  updates: InitiativeUpsert,
): void {
  const now = new Date().toISOString();
  const index = entries.findIndex((entry) => entry.name === name);
  const existing = index === -1 ? undefined : entries[index];
  const entry: InitiativeManifestEntry = {
    _type: 'initiative',
    name,
    status: updates.status,
    title: updates.title ?? existing?.title ?? 'Untitled initiative',
    created_at: existing?.created_at ?? now,
    // Terminal statuses record a completion timestamp; reopening clears it.
    completed_at: isTerminalStatus(updates.status) ? (existing?.completed_at ?? now) : null,
    reason: updates.reason ?? existing?.reason,
  };
  if (index === -1) entries.push(entry);
  else entries[index] = entry;
}

/**
 * Serialized read-modify-write of the initiatives registry. Holds a
 * process-wide lock on the manifest path across the whole read → transform →
 * write so concurrent tool calls cannot clobber each other. `transform` may run
 * IO (e.g. read the plans manifest to project status) and mutates the entries
 * array in place, returning `true` when it changed something.
 */
export function mutateInitiativesManifest<E, R>(
  transform: (entries: InitiativeManifestEntry[]) => Effect.Effect<boolean, E, R>,
): Effect.Effect<void, ReadError | PlanWriteError | E, FileSystem | R> {
  return withFileLock(
    MANIFEST_PATH,
    Effect.gen(function* () {
      const entries = yield* readInitiativesManifest();
      const changed = yield* transform(entries);
      if (changed) yield* writeInitiativesManifest(entries);
    }),
  );
}

export function upsertInitiativeEntry(
  name: string,
  updates: InitiativeUpsert,
): Effect.Effect<void, ReadError | PlanWriteError, FileSystem> {
  return mutateInitiativesManifest((entries) =>
    Effect.sync(() => {
      applyInitiativeUpsert(entries, name, updates);
      return true;
    }),
  );
}
