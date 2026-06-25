import { describe, expect, test } from 'bun:test';
import {
  computeNewActivity,
  countHealth,
  deriveHealth,
  emptyState,
  hasActivity,
  mergeState,
  type SeenState,
} from '../extensions/pr-babysitter/watcher/state';

describe('deriveHealth', () => {
  test('maps gh buckets to tri-state health', () => {
    expect(deriveHealth('pass')).toBe('passing');
    expect(deriveHealth('skipping')).toBe('passing');
    expect(deriveHealth('pending')).toBe('pending');
    expect(deriveHealth('fail')).toBe('failing');
    expect(deriveHealth('cancel')).toBe('failing');
    expect(deriveHealth('weird-unknown')).toBe('pending');
  });
});

describe('countHealth', () => {
  test('tallies by tri-state', () => {
    expect(
      countHealth([
        { name: 'a', bucket: 'pass' },
        { name: 'b', bucket: 'pending' },
        { name: 'c', bucket: 'fail' },
        { name: 'd', bucket: 'cancel' },
        { name: 'e', bucket: 'skipping' },
      ]),
    ).toEqual({ passing: 2, pending: 1, failing: 2 });
  });
});

const snap = (checks: Array<[string, string]>, comments: Array<[string, string]>) => ({
  checks: checks.map(([name, bucket]) => ({ name, bucket })),
  comments: comments.map(([id, author]) => ({ id, author, body: `body ${id}`, kind: 'review' as const })),
});

describe('computeNewActivity', () => {
  test('fires a failed check only on transition into fail', () => {
    const prev = emptyState(1);
    const first = computeNewActivity(prev, snap([['build', 'fail']], []));
    expect(first.newFailedChecks.map((c) => c.name)).toEqual(['build']);

    // Still red next poll -> no re-fire.
    const merged = mergeState(prev, snap([['build', 'fail']], []));
    const second = computeNewActivity(merged, snap([['build', 'fail']], []));
    expect(second.newFailedChecks).toEqual([]);
  });

  test('refires after fail -> pass -> fail', () => {
    let state: SeenState = emptyState(1);
    state = mergeState(state, snap([['build', 'fail']], []));
    state = mergeState(state, snap([['build', 'pass']], []));
    const again = computeNewActivity(state, snap([['build', 'fail']], []));
    expect(again.newFailedChecks.map((c) => c.name)).toEqual(['build']);
  });

  test('never fires on pending, fires on cancel', () => {
    const prev = emptyState(1);
    expect(computeNewActivity(prev, snap([['deploy', 'pending']], [])).newFailedChecks).toEqual([]);
    expect(
      computeNewActivity(prev, snap([['deploy', 'cancel']], [])).newFailedChecks.map((c) => c.name),
    ).toEqual(['deploy']);
  });

  test('pending -> failing fires once', () => {
    let state: SeenState = emptyState(1);
    state = mergeState(state, snap([['build', 'pending']], []));
    const fired = computeNewActivity(state, snap([['build', 'fail']], []));
    expect(fired.newFailedChecks.map((c) => c.name)).toEqual(['build']);
  });

  test('fires a comment once and skips the self author', () => {
    const prev = emptyState(1);
    const result = computeNewActivity(
      prev,
      snap([], [['review:1', 'reviewer'], ['issue:2', 'me']]),
      'me',
    );
    expect(result.newComments.map((c) => c.id)).toEqual(['review:1']);

    const merged = mergeState(prev, snap([], [['review:1', 'reviewer']]));
    const second = computeNewActivity(merged, snap([], [['review:1', 'reviewer']]), 'me');
    expect(second.newComments).toEqual([]);
  });
});

describe('mergeState', () => {
  test('records every comment id including self and updates buckets', () => {
    const merged = mergeState(
      emptyState(1),
      snap([['build', 'pass']], [['review:1', 'reviewer'], ['issue:2', 'me']]),
    );
    expect(merged.checkHealth).toEqual({ build: 'passing' });
    expect([...merged.seenCommentIds].sort()).toEqual(['issue:2', 'review:1']);
  });
});

describe('hasActivity', () => {
  test('detects emptiness', () => {
    expect(hasActivity({ newFailedChecks: [], newComments: [] })).toBe(false);
    expect(
      hasActivity({ newFailedChecks: [{ name: 'x', bucket: 'fail' }], newComments: [] }),
    ).toBe(true);
  });
});
