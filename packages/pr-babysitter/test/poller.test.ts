import { describe, expect, test } from 'bun:test';
import type { ExecResult } from '../extensions/pr-babysitter/cli/runner';
import { Babysitter } from '../extensions/pr-babysitter/watcher/poller';
import type { SeenState } from '../extensions/pr-babysitter/watcher/state';

const ok = (stdout: string): ExecResult => ({ stdout, stderr: '', code: 0 });

/** Programmable gh fake routed by args, with a mutable PR state. */
function makeHarness(initialState = 'OPEN') {
  let prState = initialState;
  const exec = async (_command: string, args: string[]): Promise<ExecResult> => {
    const a = args.join(' ');
    if (a === 'pr view --json number,headRefName,state,url')
      return ok(JSON.stringify({ number: 7, headRefName: 'feat/x', state: 'OPEN', url: 'u' }));
    if (a === 'pr view 7 --json state') return ok(JSON.stringify({ state: prState }));
    if (a === 'api user') return ok(JSON.stringify({ login: 'me' }));
    if (a.startsWith('pr checks 7')) return ok(JSON.stringify([{ name: 'build', bucket: 'pass' }]));
    if (a === 'pr view 7 --json comments,reviews') return ok(JSON.stringify({ comments: [], reviews: [] }));
    if (a.startsWith('api repos')) return ok(JSON.stringify([]));
    return ok('');
  };

  const wakes: string[] = [];
  const persisted: SeenState[] = [];
  const babysitter = new Babysitter({
    exec,
    wake: (text) => wakes.push(text),
    persist: (state) => persisted.push(state),
    notify: () => {},
    setStatus: () => {},
    intervalMs: 1_000_000, // never auto-fire during the test
  });

  return { babysitter, wakes, persisted, setPrState: (s: string) => (prState = s) };
}

describe('Babysitter lifecycle', () => {
  test('stops and wakes the agent when the PR is merged', async () => {
    const h = makeHarness();
    const start = await h.babysitter.start();
    expect(start.ok).toBe(true);
    expect(h.babysitter.isWatching()).toBe(true);

    h.setPrState('MERGED');
    await h.babysitter.pollOnce();

    expect(h.wakes).toEqual(['✅ PR #7 has been merged — I\'ve stopped babysitting it.']);
    expect(h.babysitter.isWatching()).toBe(false);
  });

  test('stops with a closed message when the PR is closed unmerged', async () => {
    const h = makeHarness();
    await h.babysitter.start();
    h.setPrState('CLOSED');
    await h.babysitter.pollOnce();

    expect(h.wakes[0]).toContain('was closed without merging');
    expect(h.babysitter.isWatching()).toBe(false);
  });

  test('keeps watching while the PR stays open', async () => {
    const h = makeHarness();
    await h.babysitter.start();
    await h.babysitter.pollOnce();
    expect(h.wakes).toEqual([]);
    expect(h.babysitter.isWatching()).toBe(true);
  });
});
