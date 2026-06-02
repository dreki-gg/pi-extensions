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
      // No commits yet: `git diff HEAD` errors; bare `git diff` succeeds.
      if (args.includes('HEAD')) return { fail: new Error("fatal: ambiguous argument 'HEAD'") };
      return { stdout: args.includes('--stat') ? 'wdstat' : 'wddiff', stderr: '' };
    });

    const diff = await Effect.runPromise(collectDiffEffect(cwd, {}).pipe(Effect.provide(layer)));

    expect(diff.label).toBe('working directory changes');
    expect(diff.diff).toBe('wddiff');
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
  test('splits and trims the name-only output', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: 'a.ts\n b.ts \n\n', stderr: '' }));

    const files = await Effect.runPromise(
      getChangedFilesEffect(cwd, {}).pipe(Effect.provide(layer)),
    );

    expect(files).toEqual(['a.ts', 'b.ts']);
    expect(calls[0].args).toEqual(['diff', '--name-only', 'HEAD']);
  });
});
