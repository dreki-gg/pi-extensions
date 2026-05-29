import { describe, expect, it } from 'bun:test';
import { formatSearchResult, formatSearchSummary } from '../extensions/datadog/format.js';
import type { LogSearchResult } from '../extensions/datadog/client.js';

function makeResult(overrides: Partial<LogSearchResult> = {}): LogSearchResult {
  return {
    logs: [],
    totalCount: 0,
    query: 'status:error',
    from: '2024-01-15T09:00:00.000Z',
    to: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    timestamp: '2024-01-15T09:30:00.000Z',
    status: 'error',
    service: 'my-api',
    host: 'host-1',
    message: 'Connection refused',
    tags: ['env:production'],
    attributes: {},
    ...overrides,
  };
}

describe('formatSearchResult', () => {
  it('shows "no logs found" for empty results', () => {
    const result = formatSearchResult(makeResult());
    expect(result).toContain('No logs found');
    expect(result).toContain('status:error');
    expect(result).toContain('0 logs returned');
  });

  it('formats log entries with status icons', () => {
    const result = formatSearchResult(
      makeResult({
        logs: [makeLog()],
        totalCount: 1,
      }),
    );
    expect(result).toContain('🔴');
    expect(result).toContain('`error`');
    expect(result).toContain('Connection refused');
    expect(result).toContain('my-api');
    expect(result).toContain('1 logs returned');
  });

  it('shows warning icon for warn status', () => {
    const result = formatSearchResult(
      makeResult({
        logs: [makeLog({ status: 'warn' })],
        totalCount: 1,
      }),
    );
    expect(result).toContain('🟡');
  });

  it('shows info icon for info status', () => {
    const result = formatSearchResult(
      makeResult({
        logs: [makeLog({ status: 'info' })],
        totalCount: 1,
      }),
    );
    expect(result).toContain('🔵');
  });

  it('truncates long messages', () => {
    const longMessage = 'A'.repeat(600);
    const result = formatSearchResult(
      makeResult({
        logs: [makeLog({ message: longMessage })],
        totalCount: 1,
      }),
    );
    expect(result).toContain('…');
    expect(result.length).toBeLessThan(longMessage.length + 500);
  });

  it('shows pagination notice when cursor present', () => {
    const result = formatSearchResult(makeResult({ cursor: 'abc123' }));
    expect(result).toContain('More results available');
  });

  it('shows tags', () => {
    const result = formatSearchResult(
      makeResult({
        logs: [makeLog({ tags: ['env:production', 'team:backend'] })],
        totalCount: 1,
      }),
    );
    expect(result).toContain('`env:production`');
    expect(result).toContain('`team:backend`');
  });
});

describe('formatSearchSummary', () => {
  it('returns zero counts for empty results', () => {
    const summary = formatSearchSummary(makeResult());
    expect(summary.totalCount).toBe(0);
    expect(summary.services).toEqual([]);
    expect(summary.statusBreakdown).toEqual({});
    expect(summary.hasCursor).toBe(false);
  });

  it('computes status breakdown', () => {
    const summary = formatSearchSummary(
      makeResult({
        logs: [
          makeLog({ status: 'error' }),
          makeLog({ status: 'error', id: 'log-2' }),
          makeLog({ status: 'info', id: 'log-3' }),
        ],
        totalCount: 3,
      }),
    );
    expect(summary.statusBreakdown).toEqual({ error: 2, info: 1 });
  });

  it('collects unique services', () => {
    const summary = formatSearchSummary(
      makeResult({
        logs: [
          makeLog({ service: 'api-a' }),
          makeLog({ service: 'api-b', id: 'log-2' }),
          makeLog({ service: 'api-a', id: 'log-3' }),
        ],
        totalCount: 3,
      }),
    );
    expect(summary.services.sort()).toEqual(['api-a', 'api-b']);
  });

  it('reports cursor presence', () => {
    const summary = formatSearchSummary(makeResult({ cursor: 'xyz' }));
    expect(summary.hasCursor).toBe(true);
  });
});
