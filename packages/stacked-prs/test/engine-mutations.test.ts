import { describe, expect, it } from 'bun:test';
import type { ExecResult } from '../extensions/stacked-prs/cli/runner';
import { planRebase, cascadeRebase } from '../extensions/stacked-prs/engine/rebase';
import { repairAfterMerge } from '../extensions/stacked-prs/engine/repair';
import { previewMerge } from '../extensions/stacked-prs/engine/merge';
import type { UndoJournal } from '../extensions/stacked-prs/engine/undo';
import type { Stack } from '../extensions/stacked-prs/engine/types';

type Handler = (args: string[]) => ExecResult;
const ok = (stdout = ''): ExecResult => ({ stdout, stderr: '', code: 0 });
const fail = (stderr = 'boom'): ExecResult => ({ stdout: '', stderr, code: 1 });

/** Build an exec that records calls and dispatches by "cmd arg0 arg1". */
function recorder(handlers: Record<string, Handler>) {
  const calls: string[] = [];
  const exec = async (command: string, args: string[]): Promise<ExecResult> => {
    calls.push([command, ...args].join(' '));
    for (const [prefix, handler] of Object.entries(handlers)) {
      if ([command, ...args].join(' ').startsWith(prefix)) return handler(args);
    }
    return ok();
  };
  return { exec, calls };
}

const stack = (entries: Stack['entries']): Stack => ({ trunk: 'main', entries });

describe('planRebase', () => {
  it('plans descendants with parent name onto + old parent tip from', () => {
    const s = stack([
      { branch: 'a', parentBranch: 'main' },
      { branch: 'b', parentBranch: 'a' },
      { branch: 'c', parentBranch: 'b' },
    ]);
    const oldTips = new Map([
      ['a', 'oldA'],
      ['b', 'oldB'],
    ]);
    const steps = planRebase(s, 'a', oldTips);
    expect(steps).toEqual([
      { branch: 'b', onto: 'a', from: 'oldA' },
      { branch: 'c', onto: 'b', from: 'oldB' },
    ]);
  });

  it('returns nothing for unknown branch', () => {
    expect(planRebase(stack([{ branch: 'a', parentBranch: 'main' }]), 'x', new Map())).toEqual([]);
  });
});

const journal: UndoJournal = { tips: { b: 'oldB' }, bases: {}, takenAt: 'now' };

describe('cascadeRebase', () => {
  it('rebases and force-pushes each step', async () => {
    const { exec, calls } = recorder({});
    const res = await cascadeRebase(
      exec,
      [{ branch: 'b', onto: 'a', from: 'oldA' }],
      journal,
    );
    expect(res.ok).toBe(true);
    expect(res.rebased).toEqual(['b']);
    expect(calls).toContain('git rebase --onto a oldA b');
    expect(calls).toContain('git push --force-with-lease origin b');
  });

  it('aborts and restores on conflict', async () => {
    const { exec, calls } = recorder({
      'git rebase --onto': () => fail('CONFLICT'),
    });
    const res = await cascadeRebase(
      exec,
      [{ branch: 'b', onto: 'a', from: 'oldA' }],
      journal,
    );
    expect(res.ok).toBe(false);
    expect(res.conflictBranch).toBe('b');
    expect(calls).toContain('git rebase --abort');
    // restore resets the journal tip
    expect(calls).toContain('git branch -f b oldB');
  });
});

describe('repairAfterMerge', () => {
  const merged = { branch: 'a', parentBranch: 'main', prNumber: 1, lastKnownTip: 'oldA' };
  const s = stack([
    merged,
    { branch: 'b', parentBranch: 'a', prNumber: 2 },
  ]);
  const j: UndoJournal = { tips: { a: 'oldA', b: 'oldB' }, bases: {}, takenAt: 'now' };

  it('retargets child to trunk and rebases off lastKnownTip', async () => {
    const { exec, calls } = recorder({});
    const res = await repairAfterMerge(exec, s, merged, j);
    expect(res.ok).toBe(true);
    expect(calls).toContain('gh pr edit 2 --base main');
    expect(calls).toContain('git rebase --onto origin/main oldA b');
    expect(calls).toContain('git push --force-with-lease origin b');
    // merged entry dropped, child relinked to trunk
    expect(res.stack.entries.map((e) => e.branch)).toEqual(['b']);
    expect(res.stack.entries[0]!.parentBranch).toBe('main');
  });

  it('fails clearly when lastKnownTip is missing', async () => {
    const { exec } = recorder({});
    const res = await repairAfterMerge(
      exec,
      stack([{ branch: 'a', parentBranch: 'main', prNumber: 1 }]),
      { branch: 'a', parentBranch: 'main', prNumber: 1 },
      j,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain('lastKnownTip');
  });

  it('rolls back when child rebase conflicts', async () => {
    const { exec, calls } = recorder({
      'git rebase --onto origin/main': () => fail('CONFLICT'),
    });
    const res = await repairAfterMerge(exec, s, merged, j);
    expect(res.ok).toBe(false);
    expect(calls).toContain('git rebase --abort');
    expect(calls).toContain('git branch -f a oldA');
  });
});

describe('previewMerge', () => {
  it('describes the root and descendants', () => {
    const plan = previewMerge(
      stack([
        { branch: 'a', parentBranch: 'main', prNumber: 1 },
        { branch: 'b', parentBranch: 'a', prNumber: 2 },
      ]),
    );
    expect(plan.rootBranch).toBe('a');
    expect(plan.rootPr).toBe(1);
    expect(plan.method).toBe('squash');
    expect(plan.descendantBranches).toEqual(['b']);
  });
});
