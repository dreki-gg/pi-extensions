import { describe, expect, it } from 'bun:test';
import { buildRumQuery, normalizeRumEvent } from '../extensions/datadog/rum-client.js';
import type { DatadogProjectConfig } from '../extensions/datadog/config.js';

const baseConfig: DatadogProjectConfig = {
  site: 'datadoghq.com',
  defaultTimeRange: '1h',
};

describe('buildRumQuery', () => {
  it('defaults to session events when no @type in query', () => {
    const result = buildRumQuery({ query: '@view.url_path:/checkout' }, baseConfig);
    expect(result).toBe('@view.url_path:/checkout @type:session');
  });

  it('injects @type:session for an empty query', () => {
    const result = buildRumQuery({ query: '' }, baseConfig);
    expect(result).toBe('@type:session');
  });

  it('does not inject @type:session when query already scopes @type', () => {
    const result = buildRumQuery({ query: '@type:error' }, baseConfig);
    expect(result).toBe('@type:error');
  });

  it('appends @application.id from config', () => {
    const config = { ...baseConfig, rumApplicationId: 'app-123' };
    const result = buildRumQuery({ query: '@type:view' }, config);
    expect(result).toBe('@type:view @application.id:app-123');
  });

  it('does not duplicate @application.id if already in query', () => {
    const config = { ...baseConfig, rumApplicationId: 'app-123' };
    const result = buildRumQuery({ query: '@type:view @application.id:other' }, config);
    expect(result).toBe('@type:view @application.id:other');
  });

  it('prefers rumService over service for the service filter', () => {
    const config = { ...baseConfig, service: 'api', rumService: 'web-frontend' };
    const result = buildRumQuery({ query: '@type:session' }, config);
    expect(result).toBe('@type:session service:web-frontend');
  });

  it('falls back to service when rumService is absent', () => {
    const config = { ...baseConfig, service: 'api' };
    const result = buildRumQuery({ query: '@type:session' }, config);
    expect(result).toBe('@type:session service:api');
  });

  it('appends env from config', () => {
    const config = { ...baseConfig, env: 'production' };
    const result = buildRumQuery({ query: '@type:session' }, config);
    expect(result).toBe('@type:session env:production');
  });

  it('appends defaultTags from config', () => {
    const config = { ...baseConfig, defaultTags: ['team:web', 'region:us'] };
    const result = buildRumQuery({ query: '@type:session' }, config);
    expect(result).toBe('@type:session team:web region:us');
  });

  it('does not duplicate tags whose key is already in query', () => {
    const config = { ...baseConfig, defaultTags: ['team:web'] };
    const result = buildRumQuery({ query: '@type:session team:mobile' }, config);
    expect(result).toBe('@type:session team:mobile');
  });

  it('uses param overrides over config', () => {
    const config = {
      ...baseConfig,
      rumApplicationId: 'cfg-app',
      rumService: 'cfg-svc',
      env: 'production',
    };
    const result = buildRumQuery(
      {
        query: '@type:session',
        applicationId: 'override-app',
        service: 'override-svc',
        env: 'staging',
      },
      config,
    );
    expect(result).toBe(
      '@type:session @application.id:override-app service:override-svc env:staging',
    );
  });
});

describe('normalizeRumEvent', () => {
  it('maps a full RUM event', () => {
    const event = {
      id: 'evt-1',
      type: 'rum',
      attributes: {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        service: 'web-frontend',
        tags: ['env:production', 'version:1.2.3'],
        attributes: {
          type: 'session',
          session: { id: 'sess-abc', type: 'user' },
          view: { url: 'https://app.example.com/checkout' },
        },
      },
    };

    const result = normalizeRumEvent(event as never);
    expect(result.id).toBe('evt-1');
    expect(result.timestamp).toBe('2024-01-15T10:00:00.000Z');
    expect(result.service).toBe('web-frontend');
    expect(result.tags).toEqual(['env:production', 'version:1.2.3']);
    expect(result.eventType).toBe('session');
    expect(result.attributes).toEqual({
      type: 'session',
      session: { id: 'sess-abc', type: 'user' },
      view: { url: 'https://app.example.com/checkout' },
    });
  });

  it('falls back to defaults for missing fields', () => {
    const result = normalizeRumEvent({ id: 'evt-2', attributes: {} } as never);
    expect(result.id).toBe('evt-2');
    expect(result.timestamp).toBe('unknown');
    expect(result.service).toBe('unknown');
    expect(result.eventType).toBe('unknown');
    expect(result.tags).toEqual([]);
    expect(result.attributes).toEqual({});
  });

  it('handles a completely empty event', () => {
    const result = normalizeRumEvent({} as never);
    expect(result.id).toBe('unknown');
    expect(result.eventType).toBe('unknown');
  });
});
