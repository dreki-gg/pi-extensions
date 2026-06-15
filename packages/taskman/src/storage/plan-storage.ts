/**
 * Plan document I/O — handoff and initiative markdown documents.
 *
 * The pi-specific exec-pending marker helpers live in the pi extension; this
 * engine package only needs the durable plan documents.
 */

import { Effect, Option } from 'effect';
import { FileSystem } from '../effects/filesystem.js';
import type { PlanWriteError } from '../errors.js';

export function saveHandoff(
  planDir: string,
  content: string,
): Effect.Effect<void, PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDir(planDir);
    yield* fs.writeFileString(`${planDir}/HANDOFF.md`, content);
  });
}

export function loadHandoff(planDir: string): Effect.Effect<string | undefined, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const maybeText = yield* Effect.option(fs.readFileString(`${planDir}/HANDOFF.md`));
    return Option.getOrUndefined(maybeText);
  });
}

export function saveInitiative(
  initiativeDir: string,
  content: string,
): Effect.Effect<void, PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDir(initiativeDir);
    yield* fs.writeFileString(`${initiativeDir}/INITIATIVE.md`, content);
  });
}
