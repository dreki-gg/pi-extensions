import { describe, expect, it } from 'bun:test';
import {
  formatSearchResult,
  formatSearchSummary,
  formatResultDigest,
} from '../extensions/datadog/format.js';
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

  it('does not truncate when limits are Infinity (full file output)', () => {
    const longMessage = 'A'.repeat(600);
    const result = formatSearchResult(
      makeResult({
        logs: [makeLog({ message: longMessage })],
        totalCount: 1,
      }),
      { maxMessageLength: Infinity, maxAttributesLength: Infinity },
    );
    expect(result).toContain(longMessage);
    expect(result).not.toContain('…');
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

describe('formatResultDigest', () => {
  it('reports no logs found for empty results', () => {
    const digest = formatResultDigest(makeResult());
    expect(digest).toContain('No logs found');
    expect(digest).toContain('status:error');
  });

  it('summarizes counts, status breakdown and services without full entries', () => {
    const longMessage = 'A'.repeat(600);
    const digest = formatResultDigest(
      makeResult({
        logs: [
          makeLog({ message: longMessage }),
          makeLog({ id: 'log-2', status: 'warn', service: 'api-b' }),
        ],
        totalCount: 2,
      }),
      '/tmp/pi-datadog-x/logs-1.md',
    );
    expect(digest).toContain('2 logs');
    expect(digest).toContain('error: 1');
    expect(digest).toContain('warn: 1');
    expect(digest).toContain('my-api');
    expect(digest).toContain('api-b');
    // Compact: does not embed the full log message body.
    expect(digest).not.toContain(longMessage);
  });

  it('includes the results file path and read hint when provided', () => {
    const digest = formatResultDigest(
      makeResult({ logs: [makeLog()], totalCount: 1 }),
      '/tmp/pi-datadog-x/logs-1.md',
    );
    expect(digest).toContain('/tmp/pi-datadog-x/logs-1.md');
    expect(digest).toContain('read');
  });

  it('notes pagination when a cursor is present', () => {
    const digest = formatResultDigest(
      makeResult({ logs: [makeLog()], totalCount: 1, cursor: 'abc' }),
      '/tmp/f.md',
    );
    expect(digest).toContain('more results available');
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
