/**
 * FileSystem service — the only place the code-reviewer reads disk.
 *
 * Wrapping Node's `fs/promises` behind an Effect service keeps config and lens
 * loading pure and injectable: tests swap in an in-memory implementation, and
 * read failures surface as typed `FileReadError` values.
 */

import { Context, Effect } from 'effect';
import { readFile, readdir } from 'node:fs/promises';

import { FileReadError } from '../errors';

export interface FileSystemService {
  /** Read a UTF-8 file, failing with FileReadError when unreadable/missing. */
  readonly readTextFile: (path: string) => Effect.Effect<string, FileReadError>;
  /** List directory entries, failing with FileReadError when the dir is missing. */
  readonly readDirectory: (path: string) => Effect.Effect<string[], FileReadError>;
}

export class FileSystem extends Context.Tag('CodeReviewer/FileSystem')<
  FileSystem,
  FileSystemService
>() {}

export const nodeFileSystemService: FileSystemService = {
  readTextFile: (path) =>
    Effect.tryPromise({
      try: () => readFile(path, 'utf-8'),
      catch: (cause) => new FileReadError({ path, cause }),
    }),

  readDirectory: (path) =>
    Effect.tryPromise({
      try: () => readdir(path),
      catch: (cause) => new FileReadError({ path, cause }),
    }),
};
