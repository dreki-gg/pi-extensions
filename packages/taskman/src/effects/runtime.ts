/**
 * Live Effect runtime for the plan-mode extension.
 *
 * Build the layer once inside the extension entry and run storage programs
 * through the `runPlanIO` bridge so the imperative pi event handlers keep their
 * `await fn(...)` shape.
 */

import { Effect, Layer } from 'effect';
import { FileSystem, makeNodeFileSystemService, nodeFileSystemService } from './filesystem.js';

/**
 * Build the live filesystem layer. Pass `root` to relocate the whole `.plans/`
 * registry under another working directory; omit it for the default (relative
 * paths resolve against the current working directory).
 */
export function makeRuntimeLayer(root?: string): Layer.Layer<FileSystem> {
  const service = root === undefined ? nodeFileSystemService : makeNodeFileSystemService(root);
  return Layer.succeed(FileSystem, service);
}

/**
 * Build a bridge that runs storage programs against the live filesystem layer.
 * Pass `root` to target an external working directory's `.plans/` registry.
 */
export function makePlanRuntime(root?: string) {
  const layer = makeRuntimeLayer(root);
  return function runPlanIO<A, E>(program: Effect.Effect<A, E, FileSystem>): Promise<A> {
    return Effect.runPromise(program.pipe(Effect.provide(layer)));
  };
}

export type RunPlanIO = ReturnType<typeof makePlanRuntime>;
