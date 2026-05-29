import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDiff } from '../../extensions/pr-canvas/github/parser';

const fixturesDir = join(import.meta.dir, '..', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseDiff', () => {
  const diff = loadFixture('pr-diff.txt');
  const files = parseDiff(diff);

  it('parses the correct number of files', () => {
    // 5 text files + 1 binary = 6 total
    expect(files.length).toBe(6);
  });

  it('detects added files', () => {
    const auth = files.find((f) => f.path === 'src/middleware/auth.ts');
    expect(auth).toBeDefined();
    expect(auth!.status).toBe('added');
    expect(auth!.additions).toBeGreaterThan(0);
    expect(auth!.deletions).toBe(0);
  });

  it('detects modified files', () => {
    const api = files.find((f) => f.path === 'src/routes/api.ts');
    expect(api).toBeDefined();
    expect(api!.status).toBe('modified');
    expect(api!.additions).toBeGreaterThan(0);
    expect(api!.deletions).toBeGreaterThan(0);
  });

  it('detects deleted files', () => {
    const deprecated = files.find((f) => f.path === 'src/config/deprecated.ts');
    expect(deprecated).toBeDefined();
    expect(deprecated!.status).toBe('deleted');
    expect(deprecated!.additions).toBe(0);
    expect(deprecated!.deletions).toBeGreaterThan(0);
  });

  it('counts additions and deletions per file', () => {
    const auth = files.find((f) => f.path === 'src/middleware/auth.ts')!;
    expect(auth.additions).toBe(24);
    expect(auth.deletions).toBe(0);

    const api = files.find((f) => f.path === 'src/routes/api.ts')!;
    expect(api.additions).toBe(7);
    expect(api.deletions).toBe(2);

    const deprecated = files.find((f) => f.path === 'src/config/deprecated.ts')!;
    expect(deprecated.additions).toBe(0);
    expect(deprecated.deletions).toBe(9);
  });

  it('stores the raw patch per file', () => {
    const auth = files.find((f) => f.path === 'src/middleware/auth.ts')!;
    expect(auth.patch).toContain('+import { verify }');
    expect(auth.patch).toContain('authMiddleware');
  });

  it('handles binary files gracefully', () => {
    const logo = files.find((f) => f.path === 'assets/logo.png');
    expect(logo).toBeDefined();
    expect(logo!.status).toBe('added');
    expect(logo!.additions).toBe(0);
    expect(logo!.deletions).toBe(0);
    expect(logo!.patch).toContain('Binary');
  });

  it('handles empty diff', () => {
    const result = parseDiff('');
    expect(result).toEqual([]);
  });

  it('handles diff with only whitespace', () => {
    const result = parseDiff('  \n  \n  ');
    expect(result).toEqual([]);
  });
});
