/**
 * Resolve the directory git operations should target.
 *
 * `/review` and the `code_review` tool default to the Pi session CWD, but a
 * `--repo` / `--cwd` override (or tool `cwd` param) lets a worktree or sibling
 * repo be reviewed from the same session. The override is resolved relative to
 * the session CWD (so relative worktree paths like `../project-pr35` work) and
 * validated with a single `git rev-parse --is-inside-work-tree` — that one call
 * rejects both a missing directory and a non-git path. The session CWD itself is
 * never mutated; this only redirects git/config/lens/rejections resolution.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Effect } from 'effect';
import { resolve } from 'node:path';

import { Executor, makeExecutorService } from './effects/exec';
import type { ExecError } from './errors';

const GIT_TIMEOUT_MS = 30_000;

export function resolveRepoCwdEffect(
  sessionCwd: string,
  override?: string,
): Effect.Effect<string, ExecError, Executor> {
  return Effect.gen(function* () {
    if (!override) return sessionCwd;
    const resolved = resolve(sessionCwd, override);
    const executor = yield* Executor;
    // Throws ExecError when the path is missing or not a git work tree; the
    // caller maps that to a user-facing notice rather than silently falling
    // back to the session CWD.
    yield* executor.exec('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: resolved,
      timeout: GIT_TIMEOUT_MS,
    });
    return resolved;
  });
}

/** Promise wrapper: resolve + validate the repo cwd with a live Executor from `pi`. */
export function resolveRepoCwd(
  pi: Pick<ExtensionAPI, 'exec'>,
  sessionCwd: string,
  override?: string,
): Promise<string> {
  return Effect.runPromise(
    resolveRepoCwdEffect(sessionCwd, override).pipe(
      Effect.provideService(Executor, makeExecutorService(pi)),
    ),
  );
}
