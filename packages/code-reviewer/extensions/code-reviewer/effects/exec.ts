/**
 * Executor service — wraps `pi.exec` so shelling out (git, lens tools) becomes
 * an injectable, typed Effect. Tests provide a fake executor instead of running
 * real subprocesses.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Context, Effect } from 'effect';

import { ExecError } from '../errors';

export interface ExecOptions {
  cwd?: string;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface ExecutorService {
  readonly exec: (
    command: string,
    args: string[],
    options?: ExecOptions,
  ) => Effect.Effect<ExecResult, ExecError>;
}

export class Executor extends Context.Tag('CodeReviewer/Executor')<Executor, ExecutorService>() {}

type ExecCapableApi = Pick<ExtensionAPI, 'exec'>;

/** Build a live Executor backed by `pi.exec`. */
export function makeExecutorService(pi: ExecCapableApi): ExecutorService {
  return {
    exec: (command, args, options) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pi.exec(command, args, options);
          return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
        },
        catch: (cause) => new ExecError({ command, args, cause }),
      }),
  };
}
