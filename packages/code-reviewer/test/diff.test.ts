import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';

import { collectDiffEffect, getChangedFilesEffect } from '../extensions/code-reviewer/diff';
import { ExecError } from '../extensions/code-reviewer/errors';
import { fakeExecutor } from './helpers';

const cwd = '/repo';

describe('collectDiffEffect', () => {
  test('collects staged changes', async () => {
    const { layer, calls } = fakeExecutor((_cmd, args) => ({
      stdout: args.includes('--stat') ? ' file | 1 +' : 'diff --git a b',
      stderr: '',
    }));

    const diff = await Effect.runPromise(
      collectDiffEffect(cwd, { staged: true }).pipe(Effect.provide(layer)),
    );

    expect(diff.label).toBe('staged changes');
    expect(diff.diff).toBe('diff --git a b');
    expect(calls.every((c) => c.args.includes('--staged'))).toBe(true);
  });

  test('uses base ref when provided', async () => {
    const { layer } = fakeExecutor((_cmd, args) => ({
      stdout: args.includes('--stat') ? 'stat' : 'basediff',
      stderr: '',
    }));

    const diff = await Effect.runPromise(
      collectDiffEffect(cwd, { base: 'main' }).pipe(Effect.provide(layer)),
    );

    expect(diff.label).toBe('changes since main');
    expect(diff.diff).toBe('basediff');
  });

  test('falls back to working directory when HEAD diff is empty', async () => {
    const { layer, calls } = fakeExecutor((_cmd, args) => {
      if (args.includes('ls-files')) return { stdout: '', stderr: '' }; // no untracked
      // `git diff HEAD` → empty; bare `git diff` → content.
      if (args.includes('HEAD')) return { stdout: '', stderr: '' };
      return { stdout: args.includes('--stat') ? 'wdstat' : 'wddiff', stderr: '' };
    });

    const diff = await Effect.runPromise(collectDiffEffect(cwd, {}).pipe(Effect.provide(layer)));

    expect(diff.label).toBe('working directory changes');
    expect(diff.diff).toBe('wddiff');
    expect(calls.some((c) => c.args.includes('HEAD'))).toBe(true);
  });

  test('falls back to the working directory when there is no HEAD (fresh repo)', async () => {
    const { layer } = fakeExecutor((_cmd, args) => {
      if (args.includes('ls-files')) return { stdout: '', stderr: '' }; // no untracked
      // No commits yet: `git diff HEAD` errors; bare `git diff` succeeds.
      if (args.includes('HEAD')) return { fail: new Error("fatal: ambiguous argument 'HEAD'") };
      return { stdout: args.includes('--stat') ? 'wdstat' : 'wddiff', stderr: '' };
    });

    const diff = await Effect.runPromise(collectDiffEffect(cwd, {}).pipe(Effect.provide(layer)));

    expect(diff.label).toBe('working directory changes');
    expect(diff.diff).toBe('wddiff');
  });

  test('includes untracked files alongside tracked changes by default', async () => {
    const { layer, calls } = fakeExecutor((_cmd, args) => {
      if (args.includes('--no-index')) {
        const file = args[args.length - 1];
        return { stdout: `diff --git a/${file} b/${file}\n+brand new ${file}`, stderr: '' };
      }
      if (args.includes('ls-files')) return { stdout: 'newfile.ts\n', stderr: '' };
      if (args.includes('--stat')) return { stdout: ' tracked.ts | 2 +-', stderr: '' };
      if (args.includes('HEAD'))
        return { stdout: 'diff --git a/tracked.ts b/tracked.ts', stderr: '' };
      return { stdout: '', stderr: '' };
    });

    const diff = await Effect.runPromise(collectDiffEffect(cwd, {}).pipe(Effect.provide(layer)));

    expect(diff.label).toBe('all uncommitted changes');
    expect(diff.diff).toContain('tracked.ts'); // tracked change kept
    expect(diff.diff).toContain('brand new newfile.ts'); // untracked merged in
    expect(diff.stat).toContain('newfile.ts'); // stat surfaces the new file
    expect(calls.some((c) => c.args.includes('ls-files'))).toBe(true);
    // Read-only: never stages anything.
    expect(calls.some((c) => c.args.includes('add'))).toBe(false);
  });

  test('includes untracked files even when there are no tracked changes', async () => {
    const { layer } = fakeExecutor((_cmd, args) => {
      if (args.includes('--no-index')) {
        const file = args[args.length - 1];
        return { stdout: `+brand new ${file}`, stderr: '' };
      }
      if (args.includes('ls-files')) return { stdout: 'a.ts\nb.ts\n', stderr: '' };
      return { stdout: '', stderr: '' }; // no tracked changes anywhere
    });

    const diff = await Effect.runPromise(collectDiffEffect(cwd, {}).pipe(Effect.provide(layer)));

    expect(diff.label).toBe('working directory changes');
    expect(diff.diff).toContain('brand new a.ts');
    expect(diff.diff).toContain('brand new b.ts');
  });

  test('propagates ExecError when git fails', async () => {
    const { layer } = fakeExecutor(() => ({ fail: new Error('not a git repo') }));

    const result = await Effect.runPromise(
      collectDiffEffect(cwd, { staged: true }).pipe(Effect.provide(layer), Effect.either),
    );

    expect(result._tag).toBe('Left');
    expect((result as { left: ExecError }).left).toBeInstanceOf(ExecError);
  });
});

describe('getChangedFilesEffect', () => {
  test('merges tracked + untracked names by default, deduped and trimmed', async () => {
    const { layer, calls } = fakeExecutor((_cmd, args) => {
      if (args.includes('ls-files')) return { stdout: 'new.ts\n a.ts \n', stderr: '' };
      if (args.includes('--name-only')) return { stdout: 'a.ts\n b.ts \n\n', stderr: '' };
      return { stdout: '', stderr: '' };
    });

    const files = await Effect.runPromise(
      getChangedFilesEffect(cwd, {}).pipe(Effect.provide(layer)),
    );

    // a.ts appears in both lists but is reported once.
    expect(files).toEqual(['a.ts', 'b.ts', 'new.ts']);
    expect(calls.some((c) => c.args.includes('ls-files'))).toBe(true);
  });

  test('staged uses the index name-only list without untracked files', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: 'staged.ts\n', stderr: '' }));

    const files = await Effect.runPromise(
      getChangedFilesEffect(cwd, { staged: true }).pipe(Effect.provide(layer)),
    );

    expect(files).toEqual(['staged.ts']);
    expect(calls[0].args).toEqual(['diff', '--name-only', '--staged']);
    expect(calls.some((c) => c.args.includes('ls-files'))).toBe(false);
  });
});
