import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';

import { resolveRepoCwdEffect } from '../extensions/code-reviewer/resolve-cwd';
import { fakeExecutor } from './helpers';

describe('resolveRepoCwdEffect', () => {
  test('returns session cwd unchanged when no override', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: '', stderr: '' }));
    const cwd = await Effect.runPromise(
      resolveRepoCwdEffect('/session', undefined).pipe(Effect.provide(layer)),
    );
    expect(cwd).toBe('/session');
    expect(calls.length).toBe(0);
  });

  test('resolves an absolute override and validates it is a worktree', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: 'true\n', stderr: '' }));
    const cwd = await Effect.runPromise(
      resolveRepoCwdEffect('/session', '/worktree').pipe(Effect.provide(layer)),
    );
    expect(cwd).toBe('/worktree');
    expect(calls[0].command).toBe('git');
    expect(calls[0].args).toEqual(['rev-parse', '--is-inside-work-tree']);
  });

  test('resolves a relative override against the session cwd', async () => {
    const { layer } = fakeExecutor(() => ({ stdout: 'true\n', stderr: '' }));
    const cwd = await Effect.runPromise(
      resolveRepoCwdEffect('/home/me/project', '../project-pr35').pipe(Effect.provide(layer)),
    );
    expect(cwd).toBe('/home/me/project-pr35');
  });

  test('fails when the override is not a git work tree', async () => {
    const { layer } = fakeExecutor(() => ({ fail: new Error('not a git repository') }));
    const result = await Effect.runPromiseExit(
      resolveRepoCwdEffect('/session', '/nope').pipe(Effect.provide(layer)),
    );
    expect(result._tag).toBe('Failure');
  });
});
