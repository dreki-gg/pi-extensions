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

/** git diffs are normally instant; cap them so a pathological repo can't hang
 *  the whole review. */
const GIT_TIMEOUT_MS = 30_000;

/** Cap on untracked files diffed against /dev/null so a repo full of generated
 *  junk can't blow up the prompt. The whole diff is truncated downstream too. */
const MAX_UNTRACKED_FILES = 200;

/** The empty tree object — diffing a path against it yields a full new-file
 *  diff portably (no reliance on /dev/null path handling across platforms). */
const NULL_DEVICE = '/dev/null';

function git(args: string[], cwd: string): Effect.Effect<string, ExecError, Executor> {
  return Effect.gen(function* () {
    const executor = yield* Executor;
    const result = yield* executor.exec('git', args, { cwd, timeout: GIT_TIMEOUT_MS });
    return result.stdout;
  });
}

/**
 * Diff every untracked (new, not-yet-`git add`ed) file against /dev/null so
 * brand-new files show up in a working-directory review — `git diff HEAD`
 * omits them entirely, which is exactly the class of change agents introduce.
 *
 * Read-only: it NEVER touches the index (no `git add -N`). `git diff --no-index`
 * exits non-zero when files differ, but pi.exec resolves with the diff on stdout
 * regardless; any per-file failure degrades to an empty string rather than
 * sinking the whole review.
 */
function collectUntrackedEffect(
  cwd: string,
): Effect.Effect<{ diff: string; files: string[] }, never, Executor> {
  return Effect.gen(function* () {
    const listed = yield* git(['ls-files', '--others', '--exclude-standard'], cwd).pipe(
      Effect.orElseSucceed(() => ''),
    );
    const files = listed
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    if (files.length === 0) return { diff: '', files: [] };

    const parts = yield* Effect.forEach(
      files.slice(0, MAX_UNTRACKED_FILES),
      (file) =>
        git(['diff', '--no-index', '--', NULL_DEVICE, file], cwd).pipe(
          Effect.orElseSucceed(() => ''),
        ),
      { concurrency: 4 },
    );
    return { diff: parts.filter((part) => part.trim()).join('\n'), files };
  });
}

/** Append a one-line-per-file summary of untracked files to a `--stat` block so
 *  the change overview reflects new files that git's own stat never lists. */
function appendUntrackedStat(stat: string, files: string[]): string {
  if (files.length === 0) return stat;
  const shown = files.slice(0, MAX_UNTRACKED_FILES);
  const lines = shown.map((file) => ` ${file} | (new, untracked)`);
  const note = `${files.length} untracked file(s) included`;
  return [stat.trimEnd(), ...lines, note].filter(Boolean).join('\n');
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

    // Default: EVERYTHING the agent is working on but hasn't committed —
    // tracked changes (unstaged + staged) relative to HEAD, PLUS untracked
    // (brand-new) files. `git diff HEAD` covers only the former; untracked
    // files are collected separately and merged so new files are reviewed too.
    // `git diff HEAD` also fails on a repo with no commits (HEAD is unborn), so
    // tolerate that and fall back to the bare working-directory diff.
    const headDiff = yield* git(['diff', 'HEAD'], cwd).pipe(Effect.either);
    const untracked = yield* collectUntrackedEffect(cwd);

    let tracked: string;
    let stat: string;
    let label: string;
    if (headDiff._tag === 'Left' || !headDiff.right.trim()) {
      // No HEAD (fresh repo) or no tracked changes → use the bare working dir.
      tracked = yield* git(['diff'], cwd);
      stat = yield* git(['diff', '--stat'], cwd);
      label = 'working directory changes';
    } else {
      tracked = headDiff.right;
      stat = yield* git(['diff', 'HEAD', '--stat'], cwd);
      label = 'all uncommitted changes';
    }

    const diff = [tracked, untracked.diff].filter((part) => part.trim()).join('\n');
    return { diff, stat: appendUntrackedStat(stat, untracked.files), label };
  });
}

/** Get a list of changed file paths from the diff. */
export function getChangedFilesEffect(
  cwd: string,
  options: DiffOptions,
): Effect.Effect<string[], ExecError, Executor> {
  return Effect.gen(function* () {
    if (options.staged || options.base) {
      const args = ['diff', '--name-only', options.staged ? '--staged' : options.base!];
      const stdout = yield* git(args, cwd);
      return splitPaths(stdout);
    }

    // Default: tracked changes vs HEAD (tolerate an unborn HEAD) plus untracked
    // files, deduped, so the changed-file list mirrors the merged default diff.
    const tracked = yield* git(['diff', '--name-only', 'HEAD'], cwd).pipe(
      Effect.orElseSucceed(() => ''),
    );
    const untracked = yield* git(['ls-files', '--others', '--exclude-standard'], cwd).pipe(
      Effect.orElseSucceed(() => ''),
    );
    return [...new Set([...splitPaths(tracked), ...splitPaths(untracked)])];
  });
}

function splitPaths(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
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
