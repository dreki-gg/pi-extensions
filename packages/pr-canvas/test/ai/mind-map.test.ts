import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateHeuristicMindMap } from '../../extensions/pr-canvas/ai/mind-map';
import { generateHeuristicSummary } from '../../extensions/pr-canvas/ai/summary';
import { parseDiff } from '../../extensions/pr-canvas/github/parser';
import type { PrData } from '../../extensions/pr-canvas/github/types';

const fixturesDir = join(import.meta.dir, '..', 'fixtures');
function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

function buildPrData(): PrData {
  const viewData = JSON.parse(loadFixture('pr-view.json'));
  const diff = loadFixture('pr-diff.txt');
  const checks = JSON.parse(loadFixture('pr-checks.json'));

  return {
    overview: viewData,
    files: parseDiff(diff),
    checks,
    comments: viewData.comments ?? [],
    reviews: viewData.reviews ?? [],
  };
}

describe('generateHeuristicMindMap', () => {
  const pr = buildPrData();
  const groups = generateHeuristicMindMap(pr);

  it('creates groups from file changes', () => {
    expect(groups.length).toBeGreaterThan(0);
  });

  it('separates test files from source', () => {
    const testGroup = groups.find((g) => g.changeType === 'test');
    expect(testGroup).toBeDefined();
    expect(testGroup!.files.some((f) => f.includes('test/'))).toBe(true);
  });

  it('groups source files by directory', () => {
    const sourceGroups = groups.filter((g) => g.changeType !== 'test' && g.changeType !== 'config' && g.changeType !== 'docs');
    expect(sourceGroups.length).toBeGreaterThan(0);
  });

  it('assigns meaningful labels', () => {
    for (const group of groups) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.description.length).toBeGreaterThan(0);
    }
  });

  it('handles single-file PRs', () => {
    const singleFile: PrData = {
      ...pr,
      files: [{ path: 'src/index.ts', status: 'modified', additions: 5, deletions: 2, patch: '' }],
    };
    const result = generateHeuristicMindMap(singleFile);
    expect(result.length).toBe(1);
  });

  it('handles empty files', () => {
    const empty: PrData = { ...pr, files: [] };
    expect(generateHeuristicMindMap(empty)).toEqual([]);
  });
});

describe('generateHeuristicSummary', () => {
  const pr = buildPrData();
  const summary = generateHeuristicSummary(pr);

  it('generates a purpose from the PR body', () => {
    expect(summary.purpose.length).toBeGreaterThan(0);
  });

  it('generates impact description', () => {
    expect(summary.impact).toContain('files');
  });

  it('detects failing CI checks as concerns', () => {
    expect(summary.concerns.some((c) => c.includes('Security Scan'))).toBe(true);
  });

  it('highlights new files', () => {
    expect(summary.highlights.some((h) => h.includes('new') || h.includes('New'))).toBe(true);
  });

  it('highlights deleted files', () => {
    expect(summary.highlights.some((h) => h.includes('Removed') || h.includes('removed'))).toBe(true);
  });

  it('handles empty PR gracefully', () => {
    const empty: PrData = {
      overview: {
        number: 1, title: 'Empty', body: '', author: { login: 'u' },
        state: 'OPEN', labels: [], reviewers: [], baseRefName: 'main',
        headRefName: 'fix', url: '', additions: 0, deletions: 0,
        createdAt: '', updatedAt: '',
      },
      files: [], checks: [], comments: [], reviews: [],
    };
    const result = generateHeuristicSummary(empty);
    expect(result.purpose).toBe('Empty');
    expect(result.concerns.length).toBe(0);
  });
});
