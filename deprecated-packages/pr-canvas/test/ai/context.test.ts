import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildChatContext, buildReviewContext } from '../../extensions/pr-canvas/ai/context';
import { parseDiff } from '../../extensions/pr-canvas/github/parser';
import type { PrData } from '../../extensions/pr-canvas/github/types';

const fixturesDir = join(import.meta.dir, '..', 'fixtures');
const loadFixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf-8');

function buildPrData(): { pr: PrData; rawDiff: string } {
  const viewData = JSON.parse(loadFixture('pr-view.json'));
  const rawDiff = loadFixture('pr-diff.txt');
  const checks = JSON.parse(loadFixture('pr-checks.json'));

  return {
    rawDiff,
    pr: {
      overview: viewData,
      files: parseDiff(rawDiff),
      checks,
      comments: viewData.comments ?? [],
      reviews: viewData.reviews ?? [],
    },
  };
}

describe('AI context builders', () => {
  it('builds review context with bounded diff and important PR fields', () => {
    const { pr, rawDiff } = buildPrData();
    const context = buildReviewContext(pr, rawDiff, 120);

    expect(context).toContain('Add authentication middleware');
    expect(context).toContain('Files:');
    expect(context).toContain('Checks:');
    expect(context).toContain('[truncated at 120 characters]');
  });

  it('builds chat context from PR snapshot instead of only the PR number', () => {
    const { pr, rawDiff } = buildPrData();
    const context = buildChatContext({ prData: pr, rawDiff }, 160);

    expect(context).toContain('PR #');
    expect(context).toContain('Add authentication middleware');
    expect(context).toContain('Unified diff');
    expect(context).toContain('[truncated at 160 characters]');
    expect(context).not.toBe(`PR #${pr.overview.number}`);
  });
});
