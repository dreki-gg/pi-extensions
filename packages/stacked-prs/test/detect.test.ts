import { describe, expect, it } from 'bun:test';
import { detectStack } from '../extensions/stacked-prs/cli/detect';
import type { ExecResult } from '../extensions/stacked-prs/cli/runner';

function fakeExec(map: Record<string, number>) {
  return async (command: string, args: string[]): Promise<ExecResult> => {
    const key = [command, ...args].join(' ');
    const code = key in map ? map[key]! : 127;
    return { stdout: '', stderr: '', code };
  };
}

describe('detectStack', () => {
  it('reports missing stack CLI', async () => {
    const res = await detectStack(fakeExec({}));
    expect(res.stackInstalled).toBe(false);
    expect(res.hostAuthenticated).toBe(false);
    expect(res.message).toContain('stack` CLI');
  });

  it('detects github auth', async () => {
    const res = await detectStack(
      fakeExec({ 'stack --version': 0, 'gh auth status': 0 }),
    );
    expect(res.stackInstalled).toBe(true);
    expect(res.hostAuthenticated).toBe(true);
    expect(res.host).toBe('github');
  });

  it('falls back to gitlab auth', async () => {
    const res = await detectStack(
      fakeExec({ 'stack --version': 0, 'gh auth status': 1, 'glab auth status': 0 }),
    );
    expect(res.host).toBe('gitlab');
  });

  it('reports stack present but no host auth', async () => {
    const res = await detectStack(fakeExec({ 'stack --version': 0 }));
    expect(res.stackInstalled).toBe(true);
    expect(res.hostAuthenticated).toBe(false);
    expect(res.message).toContain('auth login');
  });
});
