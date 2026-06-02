import { Effect, Layer } from 'effect';

import { Executor, type ExecResult } from '../extensions/code-reviewer/effects/exec';
import { FileSystem, type FileSystemService } from '../extensions/code-reviewer/effects/filesystem';
import { ExecError, FileReadError } from '../extensions/code-reviewer/errors';

/** In-memory FileSystem over path→content and dir→entries maps. */
export function fakeFileSystem(opts: {
  files?: Record<string, string>;
  dirs?: Record<string, string[]>;
}): FileSystemService {
  const files = opts.files ?? {};
  const dirs = opts.dirs ?? {};
  return {
    readTextFile: (path) =>
      path in files
        ? Effect.succeed(files[path])
        : Effect.fail(new FileReadError({ path, cause: new Error('ENOENT') })),
    readDirectory: (path) =>
      path in dirs
        ? Effect.succeed(dirs[path])
        : Effect.fail(new FileReadError({ path, cause: new Error('ENOENT') })),
  };
}

export function fileSystemLayer(opts: Parameters<typeof fakeFileSystem>[0]) {
  return Layer.succeed(FileSystem, fakeFileSystem(opts));
}

type ExecHandler = (command: string, args: string[]) => ExecResult | { fail: unknown };

/** Executor that dispatches to a handler and records invocations. */
export function fakeExecutor(handler: ExecHandler) {
  const calls: { command: string; args: string[] }[] = [];
  const service = {
    exec: (command: string, args: string[]) => {
      calls.push({ command, args });
      const out = handler(command, args);
      if (out && typeof out === 'object' && 'fail' in out) {
        return Effect.fail(new ExecError({ command, args, cause: out.fail }));
      }
      return Effect.succeed(out as ExecResult);
    },
  };
  return { layer: Layer.succeed(Executor, service), calls };
}
