import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { readHeadCommit } from '../git.js';

describe('readHeadCommit', () => {
  test('returns the HEAD sha inside a git repo', async () => {
    // This monorepo is a git repo, so cwd resolves a real commit.
    const sha = await readHeadCommit(process.cwd());
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  test('returns undefined outside a git repo (never throws)', async () => {
    // tmpdir is not a git repo; the helper must swallow the error.
    const sha = await readHeadCommit(tmpdir());
    expect(sha).toBeUndefined();
  });
});
