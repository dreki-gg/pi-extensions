import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import {
  loadProjectConfig,
  getCredentials,
  getCredentialStatus,
} from '../extensions/datadog/config.js';

const TMP_DIR = join(import.meta.dirname, '.tmp-config-test');

function setupTmpDir() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(join(TMP_DIR, '.pi'), { recursive: true });
}

function teardownTmpDir() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('loadProjectConfig', () => {
  beforeEach(setupTmpDir);
  afterEach(teardownTmpDir);

  it('returns defaults when no config file exists', async () => {
    const config = await loadProjectConfig(TMP_DIR);
    expect(config.site).toBe('datadoghq.com');
    expect(config.defaultTimeRange).toBe('1h');
    expect(config.service).toBeUndefined();
    expect(config.env).toBeUndefined();
    expect(config.defaultTags).toBeUndefined();
  });

  it('loads a valid config file', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'datadog.json'),
      JSON.stringify({
        service: 'my-api',
        env: 'production',
        site: 'datadoghq.eu',
        defaultTags: ['team:backend'],
        defaultTimeRange: '30m',
        rumApplicationId: 'abc-123',
        rumService: 'web-frontend',
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.service).toBe('my-api');
    expect(config.env).toBe('production');
    expect(config.site).toBe('datadoghq.eu');
    expect(config.defaultTags).toEqual(['team:backend']);
    expect(config.defaultTimeRange).toBe('30m');
    expect(config.rumApplicationId).toBe('abc-123');
    expect(config.rumService).toBe('web-frontend');
  });

  it('throws on invalid rumApplicationId type', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'datadog.json'), JSON.stringify({ rumApplicationId: 123 }));
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('"rumApplicationId" must be a string');
  });

  it('throws on invalid rumService type', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'datadog.json'), JSON.stringify({ rumService: 123 }));
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('"rumService" must be a string');
  });

  it('uses defaults for omitted fields', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'datadog.json'), JSON.stringify({ service: 'my-api' }));

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.service).toBe('my-api');
    expect(config.site).toBe('datadoghq.com');
    expect(config.defaultTimeRange).toBe('1h');
  });

  it('throws on invalid JSON', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'datadog.json'), 'not json{');
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('Invalid JSON');
  });

  it('throws on non-object JSON', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'datadog.json'), '"just a string"');
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('must be a JSON object');
  });

  it('throws on invalid field types', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'datadog.json'), JSON.stringify({ service: 123 }));
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('"service" must be a string');
  });

  it('throws on invalid defaultTags type', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'datadog.json'),
      JSON.stringify({ defaultTags: 'not-array' }),
    );
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('"defaultTags" must be an array');
  });
});

describe('getCredentials', () => {
  const origApiKey = process.env.DD_API_KEY;
  const origAppKey = process.env.DD_APP_KEY;

  afterEach(() => {
    if (origApiKey !== undefined) process.env.DD_API_KEY = origApiKey;
    else delete process.env.DD_API_KEY;
    if (origAppKey !== undefined) process.env.DD_APP_KEY = origAppKey;
    else delete process.env.DD_APP_KEY;
  });

  it('returns null when both keys missing', () => {
    delete process.env.DD_API_KEY;
    delete process.env.DD_APP_KEY;
    expect(getCredentials()).toBeNull();
  });

  it('returns null when only API key set', () => {
    process.env.DD_API_KEY = 'test-api-key';
    delete process.env.DD_APP_KEY;
    expect(getCredentials()).toBeNull();
  });

  it('returns credentials when both set', () => {
    process.env.DD_API_KEY = 'test-api-key';
    process.env.DD_APP_KEY = 'test-app-key';
    const creds = getCredentials();
    expect(creds).not.toBeNull();
    expect(creds!.apiKey).toBe('test-api-key');
    expect(creds!.appKey).toBe('test-app-key');
  });
});

describe('getCredentialStatus', () => {
  const origApiKey = process.env.DD_API_KEY;
  const origAppKey = process.env.DD_APP_KEY;

  afterEach(() => {
    if (origApiKey !== undefined) process.env.DD_API_KEY = origApiKey;
    else delete process.env.DD_API_KEY;
    if (origAppKey !== undefined) process.env.DD_APP_KEY = origAppKey;
    else delete process.env.DD_APP_KEY;
  });

  it('reports both missing', () => {
    delete process.env.DD_API_KEY;
    delete process.env.DD_APP_KEY;
    const status = getCredentialStatus();
    expect(status.hasApiKey).toBe(false);
    expect(status.hasAppKey).toBe(false);
  });

  it('reports both present', () => {
    process.env.DD_API_KEY = 'key';
    process.env.DD_APP_KEY = 'key';
    const status = getCredentialStatus();
    expect(status.hasApiKey).toBe(true);
    expect(status.hasAppKey).toBe(true);
  });
});
