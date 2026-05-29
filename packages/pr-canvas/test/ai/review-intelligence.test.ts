import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateHeuristicMindMap } from '../../extensions/pr-canvas/ai/mind-map';
import { generateReviewIntelligence } from '../../extensions/pr-canvas/ai/review-intelligence';
import { generateHeuristicSummary } from '../../extensions/pr-canvas/ai/summary';
import { parseDiff } from '../../extensions/pr-canvas/github/parser';
import type { PrData } from '../../extensions/pr-canvas/github/types';

const fixturesDir = join(import.meta.dir, '..', 'fixtures');
function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

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

describe('generateReviewIntelligence', () => {
  const { pr, rawDiff } = buildPrData();

  it('builds an architecture-review style fallback from PR metadata and diff', async () => {
    const result = await generateReviewIntelligence(pr, rawDiff);

    expect(result.summary.tldr).toContain('JWT');
    expect(result.summary.whatChanged.some((item) => item.includes('src/middleware/auth.ts:L'))).toBe(true);
    expect(result.summary.hotSpots.some((item) => item.toLowerCase().includes('fallback secret'))).toBe(true);
    expect(result.summary.openQuestions.length).toBeGreaterThan(0);
  });

  it('detects changed callable surfaces from route diffs', async () => {
    const result = await generateReviewIntelligence(pr, rawDiff);

    expect(result.summary.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', path: '/public', change: 'NEW' }),
        expect.objectContaining({ method: 'GET', path: '/data', auth: expect.stringContaining('authMiddleware'), change: 'CHANGED' }),
        expect.objectContaining({ method: 'GET', path: '/health', auth: expect.stringContaining('authMiddleware'), change: 'CHANGED' }),
      ]),
    );
  });

  it('detects exported data structures and cites source files', async () => {
    const result = await generateReviewIntelligence(pr, rawDiff);

    expect(result.summary.dataStructures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'AuthRequest', source: expect.stringContaining('src/middleware/auth.ts:L') }),
        expect.objectContaining({ name: 'TokenPayload', source: expect.stringContaining('src/middleware/token-validator.ts:L') }),
      ]),
    );
  });

  it('returns a useful mental model with a Mermaid diagram', async () => {
    const result = await generateReviewIntelligence(pr, rawDiff);

    expect(result.mindMap.length).toBeGreaterThan(0);
    expect(result.mindMap.some((group) => group.diagram?.includes('sequenceDiagram'))).toBe(true);
    expect(result.mindMap.some((group) => group.relationships?.some((rel) => rel.includes('authMiddleware')))).toBe(true);
  });

  it('uses parseable AI output when an AI boundary is supplied', async () => {
    const ai = async () => JSON.stringify({
      summary: {
        purpose: 'AI purpose',
        impact: 'AI impact',
        tldr: 'AI TLDR',
        whatChanged: ['AI changed'],
        systemFlow: ['AI flow'],
        endpoints: [],
        dataStructures: [],
        hotSpots: ['AI hot spot'],
        openQuestions: ['AI question'],
        sourceReferences: [],
        concerns: ['AI concern'],
        highlights: ['AI highlight'],
        generatedBy: 'ai',
      },
      mindMap: [
        {
          label: 'AI model',
          description: 'AI-generated mental model',
          files: ['src/index.ts'],
          changeType: 'feature',
          diagram: 'flowchart TD\n  A --> B',
          relationships: ['A calls B'],
        },
      ],
    });

    const result = await generateReviewIntelligence(pr, rawDiff, ai);

    expect(result.summary.generatedBy).toBe('ai');
    expect(result.summary.tldr).toBe('AI TLDR');
    expect(result.mindMap[0]?.diagram).toContain('flowchart TD');
  });

  it('falls back deterministically when AI output cannot be parsed', async () => {
    const ai = async () => 'not json';
    const result = await generateReviewIntelligence(pr, rawDiff, ai);

    expect(result.summary.generatedBy).toBe('heuristic');
    expect(result.summary.tldr).toContain('JWT');
  });
});

describe('generateHeuristicMindMap compatibility', () => {
  const { pr } = buildPrData();

  it('creates groups from file changes', () => {
    const groups = generateHeuristicMindMap(pr);
    expect(groups.length).toBeGreaterThan(0);
  });

  it('creates a semantic flow group for non-route service/library PRs', () => {
    const servicePr: PrData = {
      ...pr,
      overview: {
        ...pr.overview,
        title: 'Harden signed URL file fetches',
        additions: 120,
        deletions: 20,
      },
      files: [
        { path: 'server/cloud-run/src/lib/resilient-call.ts', status: 'added', additions: 40, deletions: 0, patch: '@@ -0,0 +1,40 @@\n+export async function resilientCall() {}' },
        { path: 'server/cloud-run/src/lib/signed-url.ts', status: 'modified', additions: 30, deletions: 10, patch: '@@ -1,1 +1,3 @@\n+export async function getSignedUrl() {}' },
        { path: 'server/cloud-run/src/services/files.service.ts', status: 'modified', additions: 25, deletions: 8, patch: '@@ -1,1 +1,3 @@\n+export async function fetchFile() {}' },
        { path: 'server/cloud-run/src/types/files.ts', status: 'added', additions: 12, deletions: 0, patch: '@@ -0,0 +1,12 @@\n+export interface FileDownload {\n+  url: string;\n+}' },
        { path: 'server/cloud-run/src/lib/signed-url.test.ts', status: 'added', additions: 20, deletions: 0, patch: '' },
      ],
    };

    const groups = generateHeuristicMindMap(servicePr);
    const semantic = groups[0];

    expect(semantic?.label).not.toBe('Server / Cloud-run');
    expect(semantic?.diagram).toContain('flowchart TD');
    expect(semantic?.relationships?.some((item) => item.includes('files.service.ts'))).toBe(true);
  });
});

describe('generateHeuristicSummary compatibility', () => {
  const { pr } = buildPrData();

  it('keeps legacy fields populated for existing renderers', () => {
    const summary = generateHeuristicSummary(pr);
    expect(summary.purpose.length).toBeGreaterThan(0);
    expect(summary.impact).toContain('files');
    expect(summary.concerns.some((c) => c.includes('Security Scan'))).toBe(true);
    expect(summary.highlights.length).toBeGreaterThan(0);
  });
});
