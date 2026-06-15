/**
 * FileSystem service — the single seam for plan-mode disk I/O.
 *
 * Storage programs depend on this `Context.Tag` rather than touching
 * `node:fs/promises` directly, which makes them trivially testable and keeps
 * all failure modes typed (`PlanReadError` / `PlanWriteError`).
 */

import { Context, Effect } from 'effect';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
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

export const nodeFileSystemService: FileSystemService = {
  readFileString: (path) =>
    Effect.tryPromise({
      try: () => readFile(path, 'utf-8'),
      catch: (cause) => new PlanReadError({ path, cause }),
    }),

  writeFileString: (path, data) =>
    Effect.tryPromise({
      try: () => writeFile(path, data, 'utf-8'),
      catch: (cause) => new PlanWriteError({ path, cause }),
    }),

  writeFileAtomic: (path, data) => writeFileAtomic(path, data),

  makeDir: (path) =>
    Effect.tryPromise({
      try: async () => {
        await mkdir(path, { recursive: true });
      },
      catch: (cause) => new PlanWriteError({ path, cause }),
    }),

  listDirectories: (path) =>
    Effect.tryPromise({
      try: async () => {
        const entries = await readdir(path, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      },
      catch: (cause) => new PlanReadError({ path, cause }),
    }),

  removeFile: (path) =>
    Effect.tryPromise({
      try: () => unlink(path),
      catch: (cause) => new PlanWriteError({ path, cause }),
    }),
};
