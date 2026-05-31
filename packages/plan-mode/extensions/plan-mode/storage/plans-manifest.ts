import { Effect, Either, Option } from 'effect';
import { FileSystem } from '../effects/filesystem.js';
import { JsonlParseError, JsonlValidationError, PlanWriteError } from '../errors.js';
import { decodePlanManifestEntry } from '../schema.js';

const MANIFEST_DIR = '.plans';
const MANIFEST_PATH = '.plans/plans.jsonl';

export interface PlanManifestEntry {
  _type: 'plan';
  name: string;
  status: 'in-progress' | 'done';
  title: string;
  created_at: string;
  completed_at: string | null;
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
  updates: { status: 'in-progress' | 'done'; title?: string },
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
      completed_at: updates.status === 'done' ? now : null,
    };
    if (index === -1) entries.push(entry);
    else entries[index] = entry;
    yield* writePlansManifest(entries);
  });
}
