/**
 * Diff collection.
 *
 * Git invocations run through the Executor service as typed Effects. The
 * Promise wrappers build a live Executor from `pi` for imperative call sites.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Effect } from 'effect';

import { Executor, makeExecutorService } from './effects/exec';
import type { ExecError } from './errors';

export type DiffSource = {
  diff: string;
  stat: string;
  label: string;
};

export type DiffOptions = { base?: string; staged?: boolean };

function git(args: string[], cwd: string): Effect.Effect<string, ExecError, Executor> {
  return Effect.gen(function* () {
    const executor = yield* Executor;
    const result = yield* executor.exec('git', args, { cwd });
    return result.stdout;
  });
}

/** Collect the diff from the working directory or a specific base ref. */
export function collectDiffEffect(
  cwd: string,
  options: DiffOptions,
): Effect.Effect<DiffSource, ExecError, Executor> {
  return Effect.gen(function* () {
    if (options.staged) {
      const diff = yield* git(['diff', '--staged'], cwd);
      const stat = yield* git(['diff', '--staged', '--stat'], cwd);
      return { diff, stat, label: 'staged changes' };
    }

    if (options.base) {
      const diff = yield* git(['diff', options.base], cwd);
      const stat = yield* git(['diff', options.base, '--stat'], cwd);
      return { diff, stat, label: `changes since ${options.base}` };
    }

    // Default: working directory changes (unstaged + staged) relative to HEAD.
    const diff = yield* git(['diff', 'HEAD'], cwd);

    // If no HEAD diff, fall back to just the working directory.
    if (!diff.trim()) {
      const wdDiff = yield* git(['diff'], cwd);
      const wdStat = yield* git(['diff', '--stat'], cwd);
      return { diff: wdDiff, stat: wdStat, label: 'working directory changes' };
    }

    const stat = yield* git(['diff', 'HEAD', '--stat'], cwd);
    return { diff, stat, label: 'all uncommitted changes' };
  });
}

/** Get a list of changed file paths from the diff. */
export function getChangedFilesEffect(
  cwd: string,
  options: DiffOptions,
): Effect.Effect<string[], ExecError, Executor> {
  return Effect.gen(function* () {
    const args = ['diff', '--name-only'];
    if (options.staged) args.push('--staged');
    else if (options.base) args.push(options.base);
    else args.push('HEAD');

    const stdout = yield* git(args, cwd);
    return stdout
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  });
}

// ── Promise wrappers (live Executor from pi) ──────────────────────────────────

export function collectDiff(
  pi: Pick<ExtensionAPI, 'exec'>,
  cwd: string,
  options: DiffOptions,
): Promise<DiffSource> {
  return Effect.runPromise(
    collectDiffEffect(cwd, options).pipe(Effect.provideService(Executor, makeExecutorService(pi))),
  );
}

export function getChangedFiles(
  pi: Pick<ExtensionAPI, 'exec'>,
  cwd: string,
  options: DiffOptions,
): Promise<string[]> {
  return Effect.runPromise(
    getChangedFilesEffect(cwd, options).pipe(
      Effect.provideService(Executor, makeExecutorService(pi)),
    ),
  );
}
