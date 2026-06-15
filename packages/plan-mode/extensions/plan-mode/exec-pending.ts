/**
 * Exec-pending marker I/O — the pi-mode one-shot handoff from planning to
 * execution. This is pi-workflow-specific (model + thinking preset for the
 * execution run), so it stays in the extension rather than the engine package.
 */

import { Effect, Either, Option } from 'effect';
import {
  FileSystem,
  decodeExecPendingConfig,
  type ExecPendingConfig,
  type PlanWriteError,
} from '@dreki-gg/taskman';
import { EXEC_PENDING_FILE } from './constants.js';

const PLANS_DIR = '.plans';

export function writeExecPending(
  dir: string,
  config: ExecPendingConfig,
): Effect.Effect<void, PlanWriteError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDir(dir);
    yield* fs.writeFileString(`${dir}/${EXEC_PENDING_FILE}`, JSON.stringify(config, null, 2) + '\n');
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
