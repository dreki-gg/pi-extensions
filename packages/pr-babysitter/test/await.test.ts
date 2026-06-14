import { describe, expect, test } from 'bun:test';
import type { ExecResult } from '../extensions/pr-babysitter/cli/runner';
import { awaitPrResult, formatReport } from '../extensions/pr-babysitter/watcher/await';

const ok = (stdout: string): ExecResult => ({ stdout, stderr: '', code: 0 });
const err = (): ExecResult => ({ stdout: '', stderr: 'timed out', code: 124, killed: true });

interface Frame {
  state?: string;
  /** Simulate a failed/timed-out `gh pr view --json state` call. */
  stateErr?: boolean;
  checks?: Array<{ name: string; bucket: string }>;
  comments?: Array<{ id: string; author: string; body: string }>;
}

/**
 * Drive awaitPrResult with a scripted sequence of poll frames. Each fake sleep
 * advances to the next frame and bumps the clock by one interval.
 */
function run(frames: Frame[], opts: { timeoutMs?: number; noChecksGraceMs?: number; signal?: AbortSignal } = {}) {
  const intervalMs = 1000;
  let idx = 0;
  let clock = 0;

  const exec = async (_c: string, args: string[]): Promise<ExecResult> => {
    const f = frames[Math.min(idx, frames.length - 1)] ?? {};
    const a = args.join(' ');
    if (a.endsWith('--json state'))
      return f.stateErr ? err() : ok(JSON.stringify({ state: f.state ?? 'OPEN' }));
    if (a.includes('pr checks')) return ok(JSON.stringify(f.checks ?? []));
    if (a.includes('comments,reviews'))
      return ok(JSON.stringify({ comments: (f.comments ?? []).map((c) => ({ id: c.id, author: { login: c.author }, body: c.body })), reviews: [] }));
    if (a.startsWith('api repos')) return ok(JSON.stringify([]));
    return ok('');
  };

  return awaitPrResult({
    exec,
    pr: 7,
    selfLogin: 'me',
    intervalMs,
    timeoutMs: opts.timeoutMs ?? 60_000,
    noChecksGraceMs: opts.noChecksGraceMs ?? 60_000,
    signal: opts.signal,
    now: () => clock,
    sleep: async () => {
      idx += 1;
      clock += intervalMs;
    },
  });
}

describe('awaitPrResult', () => {
  test('returns passing once checks settle green', async () => {
    const r = await run([
      { checks: [{ name: 'build', bucket: 'pending' }] },
      { checks: [{ name: 'build', bucket: 'pass' }] },
    ]);
    expect(r.outcome).toBe('passing');
    expect(r.checks).toEqual({ passing: 1, pending: 0, failing: 0 });
  });

  test('returns failing with the failing check names', async () => {
    const r = await run([
      { checks: [{ name: 'build', bucket: 'pending' }] },
      { checks: [{ name: 'build', bucket: 'fail' }, { name: 'lint', bucket: 'pass' }] },
    ]);
    expect(r.outcome).toBe('failing');
    expect(r.failingChecks).toEqual(['build']);
  });

  test('returns merged when the PR merges mid-wait', async () => {
    const r = await run([
      { checks: [{ name: 'build', bucket: 'pending' }] },
      { state: 'MERGED' },
    ]);
    expect(r.outcome).toBe('merged');
  });

  test('surfaces new comments that arrive during the wait, skipping self and baseline', async () => {
    const r = await run([
      { checks: [{ name: 'b', bucket: 'pending' }], comments: [{ id: 'old', author: 'x', body: 'pre-existing' }] },
      {
        checks: [{ name: 'b', bucket: 'pass' }],
        comments: [
          { id: 'old', author: 'x', body: 'pre-existing' },
          { id: 'new', author: 'cursor[bot]', body: 'bug here' },
          { id: 'mine', author: 'me', body: 'ignore me' },
        ],
      },
    ]);
    expect(r.outcome).toBe('passing');
    expect(r.newComments.map((c) => c.id)).toEqual(['issue:new']);
  });

  test('times out while everything stays pending', async () => {
    const r = await run([{ checks: [{ name: 'b', bucket: 'pending' }] }], { timeoutMs: 1 });
    expect(r.outcome).toBe('timeout');
  });

  test('gives up with no_checks when none register within the grace window', async () => {
    const r = await run([{ checks: [] }], { noChecksGraceMs: 0 });
    expect(r.outcome).toBe('no_checks');
  });

  test('a timed-out poll is not mistaken for no_checks; it retries and recovers', async () => {
    const r = await run([{ stateErr: true, checks: [] }, { checks: [{ name: 'b', bucket: 'pass' }] }], {
      noChecksGraceMs: 0,
    });
    expect(r.outcome).toBe('passing');
  });

  test('heartbeats onUpdate between polls so the wait looks alive', async () => {
    const updates: string[] = [];
    let clock = 0;
    let polls = 0;
    const exec = async (_c: string, args: string[]): Promise<ExecResult> => {
      const a = args.join(' ');
      if (a.endsWith('--json state')) return ok(JSON.stringify({ state: 'OPEN' }));
      if (a.includes('pr checks')) {
        polls += 1;
        return ok(JSON.stringify([{ name: 'b', bucket: polls >= 2 ? 'pass' : 'pending' }]));
      }
      if (a.includes('comments,reviews')) return ok(JSON.stringify({ comments: [], reviews: [] }));
      if (a.startsWith('api repos')) return ok(JSON.stringify([]));
      return ok('');
    };
    const r = await awaitPrResult({
      exec,
      pr: 7,
      intervalMs: 3000,
      timeoutMs: 60_000,
      noChecksGraceMs: 60_000,
      now: () => clock,
      sleep: async (ms, _sig, onTick) => {
        for (let t = 1000; t < ms; t += 1000) {
          clock += 1000;
          onTick?.();
        }
      },
      onUpdate: (s) => updates.push(s),
    });
    expect(r.outcome).toBe('passing');
    // first poll status + 2 heartbeats + second poll status
    expect(updates.length).toBeGreaterThanOrEqual(3);
    expect(updates.every((u) => u.includes('elapsed'))).toBe(true);
  });

  test('returns cancelled when the signal is already aborted', async () => {
    const r = await run([{ checks: [{ name: 'b', bucket: 'pending' }] }], {
      signal: AbortSignal.abort(),
    });
    expect(r.outcome).toBe('cancelled');
  });
});

describe('formatReport', () => {
  test('renders a failing verdict with comments', () => {
    const text = formatReport({
      pr: 7,
      outcome: 'failing',
      checks: { passing: 1, pending: 0, failing: 1 },
      failingChecks: ['build'],
      newComments: [{ id: 'inline:1', author: 'cursor[bot]', body: 'bug', kind: 'inline' }],
      elapsedMs: 252_000,
    });
    expect(text).toContain('❌ checks not passing: build');
    expect(text).toContain('[4m12s]');
    expect(text).toContain('💬 @cursor[bot]');
  });
});
