import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCanvas, type CanvasData } from '../../extensions/pr-canvas/canvas/generator';
import { parseDiff } from '../../extensions/pr-canvas/github/parser';
import type { PrData } from '../../extensions/pr-canvas/github/types';
import type { MindMapGroup, AiSummary } from '../../extensions/pr-canvas/ai/types';

const fixturesDir = join(import.meta.dir, '..', 'fixtures');
function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

function buildTestData(): CanvasData {
  const viewData = JSON.parse(loadFixture('pr-view.json'));
  const rawDiff = loadFixture('pr-diff.txt');
  const checks = JSON.parse(loadFixture('pr-checks.json'));

  const pr: PrData = {
    overview: viewData,
    files: parseDiff(rawDiff),
    checks,
    comments: viewData.comments ?? [],
    reviews: viewData.reviews ?? [],
  };

  const mindMap: MindMapGroup[] = [
    {
      label: 'Auth Middleware',
      description: 'New JWT-based authentication',
      files: ['src/middleware/auth.ts', 'src/middleware/token-validator.ts'],
      changeType: 'feature',
    },
    {
      label: 'Test Coverage',
      description: 'Tests for auth flow',
      files: ['test/auth.test.ts'],
      changeType: 'test',
    },
  ];

  const aiSummary: AiSummary = {
    purpose: 'Adds JWT authentication middleware to protect API routes.',
    impact: 'All API routes now require valid JWT tokens.',
    concerns: ['Hardcoded fallback secret in auth.ts'],
    highlights: ['New token validation utilities', 'Deprecated config cleanup'],
  };

  return { pr, rawDiff, mindMap, aiSummary };
}

describe('generateCanvas', () => {
  const html = generateCanvas(buildTestData());

  it('generates valid HTML document', () => {
    expect(html).toStartWith('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });

  it('includes title with PR number', () => {
    expect(html).toContain('PR #142');
    expect(html).toContain('Add authentication middleware');
  });

  it('includes all 7 sections', () => {
    expect(html).toContain('id="section-overview"');
    expect(html).toContain('id="section-file-tree"');
    expect(html).toContain('id="section-mind-map"');
    expect(html).toContain('id="section-diff-preview"');
    expect(html).toContain('id="section-checks"');
    expect(html).toContain('id="section-comments"');
    expect(html).toContain('id="section-ai-summary"');
  });

  it('renders file tree with Pierre Trees data', () => {
    // File paths are embedded as JSON for @pierre/trees to consume
    expect(html).toContain('id="pierre-tree-container"');
    expect(html).toContain('id="pierre-tree-data"');
    expect(html).toContain('src/middleware/auth.ts');
  });

  it('renders checks with status icons', () => {
    expect(html).toContain('Build &amp; Test');
    expect(html).toContain('Security Scan');
  });

  it('renders comments and reviews', () => {
    expect(html).toContain('reviewer1');
    expect(html).toContain('rate limiting');
  });

  it('renders mind map groups', () => {
    expect(html).toContain('Auth Middleware');
    expect(html).toContain('Test Coverage');
  });

  it('renders AI summary', () => {
    expect(html).toContain('JWT authentication middleware');
    expect(html).toContain('Hardcoded fallback secret');
  });

  it('has inline CSS (self-contained)', () => {
    expect(html).toContain('<style>');
    expect(html).not.toContain('<link rel="stylesheet"');
  });

  it('has inline JS and module scripts', () => {
    expect(html).toContain('<script>');
    expect(html).toContain('<script type="module">');
  });

  it('embeds Pierre diff data for CDN rendering', () => {
    expect(html).toContain('id="pierre-diffs-container"');
    expect(html).toContain('id="pierre-diff-data"');
    expect(html).toContain('cdn.jsdelivr.net/npm/@pierre/diffs');
    expect(html).toContain('cdn.jsdelivr.net/npm/@pierre/trees');
  });
});

describe('generateCanvas with empty data', () => {
  it('handles empty arrays gracefully', () => {
    const data: CanvasData = {
      pr: {
        overview: {
          number: 1,
          title: 'Empty PR',
          body: '',
          author: { login: 'user' },
          state: 'OPEN',
          labels: [],
          reviewers: [],
          baseRefName: 'main',
          headRefName: 'fix/empty',
          url: 'https://github.com/org/repo/pull/1',
          additions: 0,
          deletions: 0,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        files: [],
        checks: [],
        comments: [],
        reviews: [],
      },
      rawDiff: '',
      mindMap: [],
      aiSummary: {
        purpose: 'No changes.',
        impact: 'None.',
        concerns: [],
        highlights: [],
      },
    };

    const html = generateCanvas(data);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Empty PR');
    expect(html).toContain('id="section-overview"');
  });
});
