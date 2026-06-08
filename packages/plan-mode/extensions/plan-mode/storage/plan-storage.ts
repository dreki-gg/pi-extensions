/**
 * Plan disk I/O — exec-pending markers and handoff documents.
 */

import { Effect, Either, Option } from 'effect';
import { FileSystem } from '../effects/filesystem.js';
import type { PlanWriteError } from '../errors.js';
import { decodeExecPendingConfig } from '../schema.js';
import type { ExecPendingConfig } from '../types.js';
import { EXEC_PENDING_FILE } from '../constants.js';

const PLANS_DIR = '.plans';

export function writeExecPending(
  dir: string,
  config: ExecPendingConfig,
): Effect.Effect<void, PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDir(dir);
    yield* fs.writeFileString(
      `${dir}/${EXEC_PENDING_FILE}`,
      JSON.stringify(config, null, 2) + '\n',
    );
  });
}

export function readAndClearExecPending(): Effect.Effect<
  { planDir: string; config: ExecPendingConfig } | undefined,
  never,
  FileSystem
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const maybeDirs = yield* Effect.option(fs.listDirectories(PLANS_DIR));
    if (Option.isNone(maybeDirs)) return undefined;

    for (const name of maybeDirs.value) {
      const dir = `${PLANS_DIR}/${name}`;
      const markerPath = `${dir}/${EXEC_PENDING_FILE}`;
      const maybeText = yield* Effect.option(fs.readFileString(markerPath));
      if (Option.isNone(maybeText)) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(maybeText.value);
      } catch {
        continue;
      }
      const decoded = decodeExecPendingConfig(parsed);
      if (Either.isLeft(decoded)) continue;

      yield* Effect.ignore(fs.removeFile(markerPath));
      return { planDir: dir, config: decoded.right };
    }
    return undefined;
  });
}

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
