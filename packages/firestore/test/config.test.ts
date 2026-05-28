import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { loadProjectConfig, getConfigStatus } from '../extensions/firestore/config.js';

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

  it('loads a valid config with all fields', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 'my-project',
        serviceAccountKeyPath: './sa.json',
        defaultCollection: 'users',
        maxSampleSize: 20,
        scanPaths: ['src', 'lib'],
        scanExclude: ['**/*.test.ts'],
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.projectId).toBe('my-project');
    expect(config.serviceAccountKeyPath).toBe('./sa.json');
    expect(config.defaultCollection).toBe('users');
    expect(config.maxSampleSize).toBe(20);
    expect(config.scanPaths).toEqual(['src', 'lib']);
    expect(config.scanExclude).toEqual(['**/*.test.ts']);
  });

  it('uses defaults for optional fields', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 'my-project',
        serviceAccountKeyPath: './sa.json',
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.projectId).toBe('my-project');
    expect(config.defaultCollection).toBeUndefined();
    expect(config.maxSampleSize).toBe(10);
    expect(config.scanPaths).toEqual(['.']);
    expect(config.scanExclude).toEqual(['node_modules', 'dist', '.git']);
  });

  it('falls back to .firebaserc for projectId', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        serviceAccountKeyPath: './sa.json',
      }),
    );
    writeFileSync(
      join(TMP_DIR, '.firebaserc'),
      JSON.stringify({
        projects: {
          default: 'firebase-project-id',
        },
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.projectId).toBe('firebase-project-id');
  });

  it('throws when no config file and no .firebaserc', async () => {
    rmSync(join(TMP_DIR, '.pi'), { recursive: true, force: true });
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow(
      'No .pi/firestore.json found',
    );
  });

  it('throws on invalid JSON', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'firestore.json'), 'not json{');
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('Invalid JSON');
  });

  it('throws on non-object JSON', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'firestore.json'), '"just a string"');
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow(
      'must be a JSON object',
    );
  });

  it('throws when projectId missing and no .firebaserc', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        serviceAccountKeyPath: './sa.json',
      }),
    );

    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('projectId');
  });

  it('throws when serviceAccountKeyPath is missing', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 'my-project',
      }),
    );

    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow(
      'serviceAccountKeyPath',
    );
  });

  it('throws on invalid field types', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 123,
        serviceAccountKeyPath: './sa.json',
      }),
    );
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow(
      '"projectId" must be a string',
    );
  });

  it('throws on invalid maxSampleSize type', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 'my-project',
        serviceAccountKeyPath: './sa.json',
        maxSampleSize: 'ten',
      }),
    );
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow(
      '"maxSampleSize" must be a number',
    );
  });

  it('throws on invalid scanPaths type', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 'my-project',
        serviceAccountKeyPath: './sa.json',
        scanPaths: 'not-array',
      }),
    );
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow(
      '"scanPaths" must be an array of strings',
    );
  });
});

describe('getConfigStatus', () => {
  it('reports config present with project info', () => {
    const status = getConfigStatus({
      projectId: 'my-project',
      serviceAccountKeyPath: './sa.json',
      maxSampleSize: 10,
      scanPaths: ['.'],
      scanExclude: ['node_modules'],
    });
    expect(status.hasConfig).toBe(true);
    expect(status.projectId).toBe('my-project');
    expect(status.hasServiceAccount).toBe(true);
  });

  it('reports no config', () => {
    const status = getConfigStatus(null);
    expect(status.hasConfig).toBe(false);
    expect(status.projectId).toBeUndefined();
    expect(status.hasServiceAccount).toBe(false);
  });
});
