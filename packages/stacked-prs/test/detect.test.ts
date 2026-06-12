import { describe, expect, it } from 'bun:test';
import { detectGitHub } from '../extensions/stacked-prs/cli/detect';
import type { ExecResult } from '../extensions/stacked-prs/cli/runner';

function fakeExec(map: Record<string, number>) {
  return async (command: string, args: string[]): Promise<ExecResult> => {
    const key = [command, ...args].join(' ');
    const code = key in map ? map[key]! : 127;
    return { stdout: '', stderr: '', code };
  };
}

describe('detectGitHub', () => {
  it('is ready when gh is authenticated', async () => {
    const res = await detectGitHub(fakeExec({ 'gh auth status': 0 }));
    expect(res.ready).toBe(true);
  });

  it('is not ready and explains when gh is missing/unauthenticated', async () => {
    const res = await detectGitHub(fakeExec({}));
    expect(res.ready).toBe(false);
    expect(res.message).toContain('gh auth login');
  });
});
