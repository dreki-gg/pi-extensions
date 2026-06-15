/**
 * Live Effect runtime for the plan-mode extension.
 *
 * Build the layer once inside the extension entry and run storage programs
 * through the `runPlanIO` bridge so the imperative pi event handlers keep their
 * `await fn(...)` shape.
 */

import { Effect, Layer } from 'effect';
import { FileSystem, nodeFileSystemService } from './filesystem.js';

export function makeRuntimeLayer(): Layer.Layer<FileSystem> {
  return Layer.succeed(FileSystem, nodeFileSystemService);
}

/** Build a bridge that runs storage programs against the live filesystem layer. */
export function makePlanRuntime() {
  const layer = makeRuntimeLayer();
  return function runPlanIO<A, E>(program: Effect.Effect<A, E, FileSystem>): Promise<A> {
    return Effect.runPromise(program.pipe(Effect.provide(layer)));
  };
}

export type RunPlanIO = ReturnType<typeof makePlanRuntime>;
