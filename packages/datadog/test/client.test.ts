import { describe, expect, it } from 'bun:test';
import { parseRelativeTime, resolveTime, buildQuery } from '../extensions/datadog/client.js';
import type { DatadogProjectConfig } from '../extensions/datadog/config.js';

describe('parseRelativeTime', () => {
  it('parses minutes', () => {
    const now = Date.now();
    const result = parseRelativeTime('15m');
    expect(result).not.toBeNull();
    // Should be roughly 15 minutes ago (within 1 second tolerance)
    const diff = now - result!.getTime();
    expect(diff).toBeGreaterThan(14 * 60 * 1000);
    expect(diff).toBeLessThan(16 * 60 * 1000);
  });

  it('parses hours', () => {
    const now = Date.now();
    const result = parseRelativeTime('1h');
    expect(result).not.toBeNull();
    const diff = now - result!.getTime();
    expect(diff).toBeGreaterThan(59 * 60 * 1000);
    expect(diff).toBeLessThan(61 * 60 * 1000);
  });

  it('parses days', () => {
    const now = Date.now();
    const result = parseRelativeTime('7d');
    expect(result).not.toBeNull();
    const diff = now - result!.getTime();
    expect(diff).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
  });

  it('returns null for invalid formats', () => {
    expect(parseRelativeTime('abc')).toBeNull();
    expect(parseRelativeTime('15s')).toBeNull();
    expect(parseRelativeTime('now')).toBeNull();
    expect(parseRelativeTime('')).toBeNull();
  });
});

describe('resolveTime', () => {
  it('resolves "now" to current time', () => {
    const before = Date.now();
    const result = resolveTime('now');
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('resolves relative time strings', () => {
    const result = resolveTime('1h');
    const diff = Date.now() - result.getTime();
    expect(diff).toBeGreaterThan(59 * 60 * 1000);
    expect(diff).toBeLessThan(61 * 60 * 1000);
  });

  it('resolves ISO 8601 dates', () => {
    const result = resolveTime('2024-01-15T10:00:00Z');
    expect(result.toISOString()).toBe('2024-01-15T10:00:00.000Z');
  });

  it('throws on invalid input', () => {
    expect(() => resolveTime('garbage')).toThrow('Invalid time format');
  });
});

describe('buildQuery', () => {
  const baseConfig: DatadogProjectConfig = {
    site: 'datadoghq.com',
    defaultTimeRange: '1h',
  };

  it('returns query as-is when no config defaults', () => {
    const result = buildQuery({ query: 'status:error' }, baseConfig);
    expect(result).toBe('status:error');
  });

  it('appends service from config', () => {
    const config = { ...baseConfig, service: 'my-api' };
    const result = buildQuery({ query: 'status:error' }, config);
    expect(result).toBe('status:error service:my-api');
  });

  it('appends env from config', () => {
    const config = { ...baseConfig, env: 'production' };
    const result = buildQuery({ query: 'status:error' }, config);
    expect(result).toBe('status:error env:production');
  });

  it('appends defaultTags from config', () => {
    const config = { ...baseConfig, defaultTags: ['team:backend', 'region:us'] };
    const result = buildQuery({ query: 'status:error' }, config);
    expect(result).toBe('status:error team:backend region:us');
  });

  it('does not duplicate service if already in query', () => {
    const config = { ...baseConfig, service: 'my-api' };
    const result = buildQuery({ query: 'service:other-api status:error' }, config);
    expect(result).toBe('service:other-api status:error');
  });

  it('does not duplicate env if already in query', () => {
    const config = { ...baseConfig, env: 'production' };
    const result = buildQuery({ query: 'env:staging status:error' }, config);
    expect(result).toBe('env:staging status:error');
  });

  it('does not duplicate tags if key already in query', () => {
    const config = { ...baseConfig, defaultTags: ['team:backend'] };
    const result = buildQuery({ query: 'team:frontend status:error' }, config);
    expect(result).toBe('team:frontend status:error');
  });

  it('uses param overrides over config', () => {
    const config = { ...baseConfig, service: 'default-api', env: 'production' };
    const result = buildQuery(
      { query: 'status:error', service: 'override-api', env: 'staging' },
      config,
    );
    expect(result).toBe('status:error service:override-api env:staging');
  });
});
