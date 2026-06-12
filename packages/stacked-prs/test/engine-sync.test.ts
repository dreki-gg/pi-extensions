import { describe, expect, it } from 'bun:test';
import type { ExecResult } from '../extensions/stacked-prs/cli/runner';
import { previewSync } from '../extensions/stacked-prs/engine/sync';
import { mergeRoot } from '../extensions/stacked-prs/engine/merge';

type Handler = (args: string[]) => ExecResult;
const ok = (stdout = ''): ExecResult => ({ stdout, stderr: '', code: 0 });

function recorder(handlers: Record<string, Handler>) {
  const calls: string[] = [];
  const exec = async (command: string, args: string[]): Promise<ExecResult> => {
    const key = [command, ...args].join(' ');
    calls.push(key);
    for (const [prefix, handler] of Object.entries(handlers)) {
      if (key.startsWith(prefix)) return handler(args);
    }
    return ok();
  };
  return { exec, calls };
}

const PR_LIST = JSON.stringify([
  { number: 1, headRefName: 'a', baseRefName: 'main', title: 'A' },
  { number: 2, headRefName: 'b', baseRefName: 'a', title: 'B' },
]);

describe('previewSync', () => {
  it('infers stacks and reports no repairs when PRs are open', async () => {
    const { exec } = recorder({
      'git symbolic-ref --short refs/remotes/origin/HEAD': () => ok('origin/main'),
      'gh pr list': () => ok(PR_LIST),
      // both PRs open
      'gh pr view 1': () => ok(JSON.stringify({ number: 1, headRefName: 'a', baseRefName: 'main', title: 'A', state: 'OPEN' })),
      'gh pr view 2': () => ok(JSON.stringify({ number: 2, headRefName: 'b', baseRefName: 'a', title: 'B', state: 'OPEN' })),
    });
    const preview = await previewSync(exec);
    expect(preview.trunk).toBe('main');
    expect(preview.state.stacks).toHaveLength(1);
    expect(preview.state.stacks[0]!.entries.map((e) => e.branch)).toEqual(['a', 'b']);
    expect(preview.repairs).toHaveLength(0);
    expect(preview.summary).toContain('No repairs needed');
  });

  it('flags merged + deleted branches as pending repairs', async () => {
    const { exec } = recorder({
      'git symbolic-ref --short refs/remotes/origin/HEAD': () => ok('origin/main'),
      'gh pr list': () => ok(PR_LIST),
      'gh pr view 1': () => ok(JSON.stringify({ number: 1, headRefName: 'a', baseRefName: 'main', title: 'A', state: 'MERGED' })),
      'gh pr view 2': () => ok(JSON.stringify({ number: 2, headRefName: 'b', baseRefName: 'a', title: 'B', state: 'OPEN' })),
      // branch 'a' gone from remote, 'b' present
      'git ls-remote --heads origin a': () => ok(''),
      'git ls-remote --heads origin b': () => ok('sha\trefs/heads/b'),
    });
    const preview = await previewSync(exec);
    expect(preview.repairs).toHaveLength(1);
    expect(preview.repairs[0]!.branches).toEqual(['a']);
    expect(preview.summary).toContain('Pending repairs');
  });
});

describe('mergeRoot', () => {
  it('merges the root PR then repairs the descendant', async () => {
    const { exec, calls } = recorder({
      'git rev-parse --verify --quiet a': () => ok('oldA'),
      'git rev-parse --verify --quiet b': () => ok('oldB'),
      'gh pr merge 1': () => ok('merged'),
    });
    const stack = {
      trunk: 'main',
      entries: [
        { branch: 'a', parentBranch: 'main', prNumber: 1 },
        { branch: 'b', parentBranch: 'a', prNumber: 2 },
      ],
    };
    const res = await mergeRoot(exec, stack);
    expect(res.ok).toBe(true);
    expect(calls).toContain('gh pr merge 1 --squash --delete-branch');
    expect(calls).toContain('gh pr edit 2 --base main');
    expect(res.stack.entries.map((e) => e.branch)).toEqual(['b']);
  });

  it('fails when there is no root PR', async () => {
    const { exec } = recorder({});
    const res = await mergeRoot(exec, { trunk: 'main', entries: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('No root PR');
  });
});
