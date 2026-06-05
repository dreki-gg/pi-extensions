import { describe, expect, it } from 'bun:test';
import {
  formatRumSearchResult,
  formatRumSearchSummary,
  formatRumResultDigest,
} from '../extensions/datadog/rum-format.js';
import type { RumSearchResult } from '../extensions/datadog/rum-client.js';

function makeResult(overrides: Partial<RumSearchResult> = {}): RumSearchResult {
  return {
    events: [],
    totalCount: 0,
    query: '@type:session',
    from: '2024-01-15T09:00:00.000Z',
    to: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    eventType: 'session',
    timestamp: '2024-01-15T09:30:00.000Z',
    service: 'web-frontend',
    tags: ['env:production'],
    attributes: { session: { id: 'sess-1' } },
    ...overrides,
  };
}

describe('formatRumSearchResult', () => {
  it('shows "no RUM events found" for empty results', () => {
    const result = formatRumSearchResult(makeResult());
    expect(result).toContain('No RUM events found');
    expect(result).toContain('@type:session');
    expect(result).toContain('0');
  });

  it('formats event entries with type and service', () => {
    const result = formatRumSearchResult(makeResult({ events: [makeEvent()], totalCount: 1 }));
    expect(result).toContain('session');
    expect(result).toContain('web-frontend');
    expect(result).toContain('sess-1');
  });

  it('truncates long attributes by default', () => {
    const big = { note: 'A'.repeat(600) };
    const result = formatRumSearchResult(
      makeResult({ events: [makeEvent({ attributes: big })], totalCount: 1 }),
    );
    expect(result).toContain('…');
  });

  it('does not truncate when limits are Infinity (full file output)', () => {
    const big = 'A'.repeat(600);
    const result = formatRumSearchResult(
      makeResult({ events: [makeEvent({ attributes: { note: big } })], totalCount: 1 }),
      { maxAttributesLength: Infinity },
    );
    expect(result).toContain(big);
    expect(result).not.toContain('…');
  });

  it('shows pagination notice when cursor present', () => {
    const result = formatRumSearchResult(makeResult({ cursor: 'abc123' }));
    expect(result).toContain('More results available');
  });
});

describe('formatRumResultDigest', () => {
  it('reports no events found for empty results', () => {
    const digest = formatRumResultDigest(makeResult());
    expect(digest).toContain('No RUM events found');
  });

  it('summarizes counts, type breakdown and services', () => {
    const digest = formatRumResultDigest(
      makeResult({
        events: [
          makeEvent(),
          makeEvent({ id: 'evt-2', eventType: 'error', service: 'web-frontend' }),
          makeEvent({ id: 'evt-3', eventType: 'view', service: 'mobile' }),
        ],
        totalCount: 3,
      }),
      '/tmp/pi-datadog-x/rum-1.md',
    );
    expect(digest).toContain('3 RUM events');
    expect(digest).toContain('session: 1');
    expect(digest).toContain('error: 1');
    expect(digest).toContain('view: 1');
    expect(digest).toContain('web-frontend');
    expect(digest).toContain('mobile');
  });

  it('includes the results file path and read hint when provided', () => {
    const digest = formatRumResultDigest(
      makeResult({ events: [makeEvent()], totalCount: 1 }),
      '/tmp/pi-datadog-x/rum-1.md',
    );
    expect(digest).toContain('/tmp/pi-datadog-x/rum-1.md');
    expect(digest).toContain('read');
  });

  it('notes pagination when a cursor is present', () => {
    const digest = formatRumResultDigest(
      makeResult({ events: [makeEvent()], totalCount: 1, cursor: 'abc' }),
      '/tmp/f.md',
    );
    expect(digest).toContain('more results available');
  });
});

describe('formatRumSearchSummary', () => {
  it('returns zero counts for empty results', () => {
    const summary = formatRumSearchSummary(makeResult());
    expect(summary.totalCount).toBe(0);
    expect(summary.services).toEqual([]);
    expect(summary.typeBreakdown).toEqual({});
    expect(summary.hasCursor).toBe(false);
  });

  it('computes type breakdown and unique services', () => {
    const summary = formatRumSearchSummary(
      makeResult({
        events: [
          makeEvent({ eventType: 'session', service: 'a' }),
          makeEvent({ id: 'evt-2', eventType: 'session', service: 'b' }),
          makeEvent({ id: 'evt-3', eventType: 'view', service: 'a' }),
        ],
        totalCount: 3,
      }),
    );
    expect(summary.typeBreakdown).toEqual({ session: 2, view: 1 });
    expect(summary.services.sort()).toEqual(['a', 'b']);
  });

  it('reports cursor presence', () => {
    const summary = formatRumSearchSummary(makeResult({ cursor: 'xyz' }));
    expect(summary.hasCursor).toBe(true);
  });
});
