import { describe, expect, it } from 'bun:test';
import { reconcile } from '../extensions/stacked-prs/engine/reconcile';
import {
  BLOCK_END,
  BLOCK_START,
  renderStackBlock,
  upsertStackBlock,
} from '../extensions/stacked-prs/engine/description';
import {
  deserializeState,
  serializeState,
} from '../extensions/stacked-prs/engine/state';
import { parseGhPrList, parseGhPrView } from '../extensions/stacked-prs/engine/gh';
import { emptyState, type Stack, type StackState } from '../extensions/stacked-prs/engine/types';

const stack = (trunk: string, entries: Stack['entries']): Stack => ({ trunk, entries });

describe('reconcile', () => {
  it('carries forward lastKnownTip for surviving branches', () => {
    const stored: StackState = {
      version: 1,
      stacks: [stack('main', [{ branch: 'a', parentBranch: 'main', lastKnownTip: 'sha-a' }])],
    };
    const inferred = [stack('main', [{ branch: 'a', parentBranch: 'main', prNumber: 1 }])];
    const out = reconcile(stored, inferred);
    expect(out.stacks[0]!.entries[0]!.lastKnownTip).toBe('sha-a');
    expect(out.stacks[0]!.entries[0]!.prNumber).toBe(1);
  });

  it('drops tips for branches no longer inferred', () => {
    const stored: StackState = {
      version: 1,
      stacks: [stack('main', [{ branch: 'gone', parentBranch: 'main', lastKnownTip: 'x' }])],
    };
    const out = reconcile(stored, [stack('main', [{ branch: 'b', parentBranch: 'main' }])]);
    expect(out.stacks[0]!.entries[0]!.branch).toBe('b');
    expect(out.stacks[0]!.entries[0]!.lastKnownTip).toBeUndefined();
  });
});

describe('description block', () => {
  it('renders a block with markers and PR refs', () => {
    const block = renderStackBlock(
      stack('main', [{ branch: 'a', parentBranch: 'main', prNumber: 1 }]),
    );
    expect(block).toContain(BLOCK_START);
    expect(block).toContain(BLOCK_END);
    expect(block).toContain('a #1');
    expect(block).toContain('main');
  });

  it('inserts when no block present', () => {
    const out = upsertStackBlock('Hello world.', 'BLOCK');
    expect(out).toContain('Hello world.');
    expect(out).toContain('BLOCK');
  });

  it('replaces an existing block idempotently', () => {
    const body = `Intro\n\n${BLOCK_START}\nold\n${BLOCK_END}\n\nOutro`;
    const block = `${BLOCK_START}\nnew\n${BLOCK_END}`;
    const out = upsertStackBlock(body, block);
    expect(out).toContain('new');
    expect(out).not.toContain('old');
    expect(out).toContain('Intro');
    expect(out).toContain('Outro');
    // Idempotent: second upsert yields the same result.
    expect(upsertStackBlock(out, block)).toBe(out);
  });
});

describe('state serialization', () => {
  it('round-trips', () => {
    const s: StackState = {
      version: 1,
      stacks: [stack('main', [{ branch: 'a', parentBranch: 'main', prNumber: 7, lastKnownTip: 'z' }])],
    };
    expect(deserializeState(serializeState(s))).toEqual(s);
  });

  it('returns empty state on corrupt/missing input', () => {
    expect(deserializeState('not json')).toEqual(emptyState());
    expect(deserializeState(null)).toEqual(emptyState());
    expect(deserializeState('{"stacks":"nope"}')).toEqual(emptyState());
  });
});

describe('gh parsing', () => {
  it('parses pr list json', () => {
    const json = JSON.stringify([
      { number: 1, headRefName: 'a', baseRefName: 'main', title: 'A' },
      { number: 2, headRefName: 'b', baseRefName: 'a', title: 'B' },
    ]);
    const prs = parseGhPrList(json);
    expect(prs).toHaveLength(2);
    expect(prs[1]!.baseRefName).toBe('a');
  });

  it('parses pr view json with state + mergeCommit', () => {
    const json = JSON.stringify({
      number: 5,
      headRefName: 'a',
      baseRefName: 'main',
      title: 'A',
      state: 'merged',
      mergeCommit: { oid: 'deadbeef' },
    });
    const pr = parseGhPrView(json)!;
    expect(pr.state).toBe('MERGED');
    expect(pr.mergeCommit).toBe('deadbeef');
  });

  it('tolerates junk', () => {
    expect(parseGhPrList('boom')).toEqual([]);
    expect(parseGhPrView('boom')).toBeNull();
  });
});
