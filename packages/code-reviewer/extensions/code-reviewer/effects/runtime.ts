/**
 * Live Effect layers for the code-reviewer extension.
 *
 * `fileSystemLayer` covers disk-only programs (config + lens loading).
 * `makeRuntimeLayer(pi)` adds the `pi.exec`-backed Executor for git/diff and
 * lens-tool programs.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Layer } from 'effect';

import { Executor, makeExecutorService } from './exec';
import { FileSystem, nodeFileSystemService } from './filesystem';

export const fileSystemLayer = Layer.succeed(FileSystem, nodeFileSystemService);

export function makeRuntimeLayer(pi: Pick<ExtensionAPI, 'exec'>) {
  return Layer.mergeAll(fileSystemLayer, Layer.succeed(Executor, makeExecutorService(pi)));
}

export type CodeReviewerServices = FileSystem | Executor;
