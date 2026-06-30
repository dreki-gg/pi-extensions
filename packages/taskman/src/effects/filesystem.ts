/**
 * FileSystem service — the single seam for plan-mode disk I/O.
 *
 * Storage programs depend on this `Context.Tag` rather than touching
 * `node:fs/promises` directly, which makes them trivially testable and keeps
 * all failure modes typed (`PlanReadError` / `PlanWriteError`).
 */

import { Context, Effect } from 'effect';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PlanReadError, PlanWriteError } from '../errors.js';
import { writeFileAtomic } from '../storage/atomic-write.js';

export interface FileSystemService {
  readonly readFileString: (path: string) => Effect.Effect<string, PlanReadError>;
  readonly writeFileString: (path: string, data: string) => Effect.Effect<void, PlanWriteError>;
  readonly writeFileAtomic: (path: string, data: string) => Effect.Effect<void, PlanWriteError>;
  readonly makeDir: (path: string) => Effect.Effect<void, PlanWriteError>;
  readonly listDirectories: (path: string) => Effect.Effect<string[], PlanReadError>;
  readonly removeFile: (path: string) => Effect.Effect<void, PlanWriteError>;
}

export class FileSystem extends Context.Tag('PlanMode/FileSystem')<
  FileSystem,
  FileSystemService
>() {}

/**
 * Build a node-backed filesystem service whose relative paths resolve against
 * `root`. All storage programs use relative `.plans/...` paths, so prefixing a
 * root relocates the entire plan registry coherently (manifests, plan dirs,
 * handoffs) to another working directory.
 *
 * `resolve(root, p)` is a no-op for already-absolute paths and reproduces the
 * default `process.cwd()` behaviour exactly when `root === process.cwd()`, so
 * the common (no-target) path is unchanged.
 */
export function makeNodeFileSystemService(root: string): FileSystemService {
  const at = (path: string) => resolve(root, path);
  return {
    readFileString: (path) =>
      Effect.tryPromise({
        try: () => readFile(at(path), 'utf-8'),
        catch: (cause) => new PlanReadError({ path, cause }),
      }),

    writeFileString: (path, data) =>
      Effect.tryPromise({
        try: () => writeFile(at(path), data, 'utf-8'),
        catch: (cause) => new PlanWriteError({ path, cause }),
      }),

    writeFileAtomic: (path, data) => writeFileAtomic(at(path), data),

    makeDir: (path) =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(at(path), { recursive: true });
        },
        catch: (cause) => new PlanWriteError({ path, cause }),
      }),

    listDirectories: (path) =>
      Effect.tryPromise({
        try: async () => {
          const entries = await readdir(at(path), { withFileTypes: true });
          return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        },
        catch: (cause) => new PlanReadError({ path, cause }),
      }),

    removeFile: (path) =>
      Effect.tryPromise({
        try: () => unlink(at(path)),
        catch: (cause) => new PlanWriteError({ path, cause }),
      }),
  };
}

/**
 * Default service: relative paths resolve against the current working directory
 * at call time. `resolve('.', p)` is equivalent to `resolve(process.cwd(), p)`,
 * so this matches the historical behaviour of passing raw relative paths to fs.
 */
export const nodeFileSystemService: FileSystemService = makeNodeFileSystemService('.');
