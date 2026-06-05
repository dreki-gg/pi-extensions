import { describe, expect, test } from 'bun:test';
import {
  resolveTargetRef,
  type SnapshotRefEntry,
} from '../../extensions/browser-tools/backends/resolve-target.js';

function deps(textByRef: Record<string, string> = {}) {
  const calls: string[] = [];
  return {
    calls,
    getVisibleText: async (refId: string) => {
      calls.push(refId);
      return textByRef[refId] ?? null;
    },
  };
}

const refs = (...entries: Array<[string, { name?: string; role?: string }]>): SnapshotRefEntry[] =>
  entries;

describe('resolveTargetRef', () => {
  test('tier 1: matches a unique exact accessible name', async () => {
    const d = deps();
    const result = await resolveTargetRef(
      'Play',
      refs(['e1', { name: 'Play', role: 'button' }], ['e2', { name: 'Pause', role: 'button' }]),
      d,
    );
    expect(result).toBe('@e1');
    // exact name match short-circuits before any visible-text lookups
    expect(d.calls).toHaveLength(0);
  });

  test('trims the incoming text before matching', async () => {
    const result = await resolveTargetRef(
      '  Play  ',
      refs(['e1', { name: 'Play', role: 'button' }]),
      deps(),
    );
    expect(result).toBe('@e1');
  });

  test('tier 2: falls back to exact visible text when names do not match', async () => {
    const d = deps({ e1: 'Echoes of Home', e2: 'Other' });
    const result = await resolveTargetRef(
      'Echoes of Home',
      refs(['e1', { role: 'link' }], ['e2', { role: 'link' }]),
      d,
    );
    expect(result).toBe('@e1');
  });

  test('tier 3: case-insensitive substring on accessible name', async () => {
    const result = await resolveTargetRef(
      'echoes of home',
      refs(
        ['e1', { name: 'Echoes of Home — play', role: 'img' }],
        ['e2', { name: 'Distant Skies', role: 'img' }],
      ),
      deps(),
    );
    expect(result).toBe('@e1');
  });

  test('tier 4: case-insensitive substring on visible text', async () => {
    const d = deps({ e1: 'Echoes of Home (Deluxe)', e2: 'Distant Skies' });
    const result = await resolveTargetRef(
      'Echoes of Home',
      refs(['e1', { role: 'listitem' }], ['e2', { role: 'listitem' }]),
      d,
    );
    expect(result).toBe('@e1');
  });

  test('exact tiers win over a looser substring match on another element', async () => {
    // e2 is an exact name match; e1 would substring-match, but exact must win.
    const result = await resolveTargetRef(
      'Home',
      refs(
        ['e1', { name: 'Echoes of Home', role: 'img' }],
        ['e2', { name: 'Home', role: 'button' }],
      ),
      deps(),
    );
    expect(result).toBe('@e2');
  });

  test('throws an ambiguity error when multiple exact names match', async () => {
    await expect(
      resolveTargetRef(
        'Play',
        refs(['e1', { name: 'Play', role: 'button' }], ['e2', { name: 'Play', role: 'link' }]),
        deps(),
      ),
    ).rejects.toThrow(/multiple matches.*accessible name/i);
  });

  test('throws an ambiguity error when multiple substring names match', async () => {
    await expect(
      resolveTargetRef(
        'home',
        refs(
          ['e1', { name: 'Echoes of Home', role: 'img' }],
          ['e2', { name: 'Coming Home', role: 'img' }],
        ),
        deps(),
      ),
    ).rejects.toThrow(/multiple matches.*accessible name/i);
  });

  test('throws a not-found error when nothing matches at any tier', async () => {
    await expect(
      resolveTargetRef('Nonexistent', refs(['e1', { name: 'Play', role: 'button' }]), deps()),
    ).rejects.toThrow(/Could not resolve a unique interactive element/i);
  });
});
