import { Context, Effect } from 'effect';
import { readFile, readdir } from 'node:fs/promises';
import { ConfigReadError, ServiceAccountReadError } from '../errors.js';

export interface FileSystemService {
  readonly readConfigFileString: (path: string) => Effect.Effect<string, ConfigReadError>;
  readonly readServiceAccountFileString: (
    path: string,
    environment: string,
  ) => Effect.Effect<string, ServiceAccountReadError>;
  readonly readFileString: (path: string) => Effect.Effect<string, unknown>;
  readonly readDirectory: (
    path: string,
    options?: { readonly recursive?: boolean },
  ) => Effect.Effect<string[], unknown>;
}

export class FileSystem extends Context.Tag('Firestore/FileSystem')<
  FileSystem,
  FileSystemService
>() {}

export const nodeFileSystemService: FileSystemService = {
  readConfigFileString: (path) =>
    Effect.tryPromise({
      try: () => readFile(path, 'utf-8'),
      catch: (cause) => new ConfigReadError({ path, cause }),
    }),

  readServiceAccountFileString: (path, environment) =>
    Effect.tryPromise({
      try: () => readFile(path, 'utf-8'),
      catch: (cause) => new ServiceAccountReadError({ path, environment, cause }),
    }),

  readFileString: (path) =>
    Effect.tryPromise({
      try: () => readFile(path, 'utf-8'),
      catch: (cause) => cause,
    }),

  readDirectory: (path, options) =>
    Effect.tryPromise({
      try: () => readdir(path, options),
      catch: (cause) => cause,
    }),
};
