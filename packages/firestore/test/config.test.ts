import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { Effect } from 'effect';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import {
  loadProjectConfig,
  loadProjectConfigEffect,
  getConfigStatus,
  resolveEnvironmentConfig,
} from '../extensions/firestore/config.js';
import { FileSystem, nodeFileSystemService } from '../extensions/firestore/effects/filesystem.js';

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
    expect(config.defaultEnvironment).toBe('default');
    expect(Object.keys(config.environments)).toEqual(['default']);
  });

  it('loads multiple named environments and selects the configured default', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        defaultEnvironment: 'development',
        environments: {
          development: {
            projectId: 'my-project-dev',
            serviceAccountKeyPath: './dev-sa.json',
            defaultCollection: 'devUsers',
          },
          staging: {
            projectId: 'my-project-staging',
            serviceAccountKeyPath: './staging-sa.json',
          },
        },
        maxSampleSize: 20,
        scanPaths: ['src', 'lib'],
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.defaultEnvironment).toBe('development');
    expect(config.projectId).toBe('my-project-dev');
    expect(config.serviceAccountKeyPath).toBe('./dev-sa.json');
    expect(config.defaultCollection).toBe('devUsers');
    expect(config.environments.development.projectId).toBe('my-project-dev');
    expect(config.environments.staging.projectId).toBe('my-project-staging');
    expect(config.maxSampleSize).toBe(20);
    expect(config.scanPaths).toEqual(['src', 'lib']);
  });

  it('defaults to the first environment when defaultEnvironment is omitted', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        environments: {
          development: {
            projectId: 'my-project-dev',
            serviceAccountKeyPath: './dev-sa.json',
          },
          staging: {
            projectId: 'my-project-staging',
            serviceAccountKeyPath: './staging-sa.json',
          },
        },
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.defaultEnvironment).toBe('development');
    expect(config.projectId).toBe('my-project-dev');
  });

  it('throws when defaultEnvironment does not match a configured environment', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        defaultEnvironment: 'production',
        environments: {
          development: {
            projectId: 'my-project-dev',
            serviceAccountKeyPath: './dev-sa.json',
          },
        },
      }),
    );

    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('defaultEnvironment');
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

  it('loads from .pi/firebase.json as fallback', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firebase.json'),
      JSON.stringify({
        projectId: 'my-project',
        serviceAccountKeyPath: './sa.json',
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.projectId).toBe('my-project');
  });

  it('prefers .pi/firestore.json over .pi/firebase.json', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 'from-firestore',
        serviceAccountKeyPath: './sa.json',
      }),
    );
    writeFileSync(
      join(TMP_DIR, '.pi', 'firebase.json'),
      JSON.stringify({
        projectId: 'from-firebase',
        serviceAccountKeyPath: './sa.json',
      }),
    );

    const config = await loadProjectConfig(TMP_DIR);
    expect(config.projectId).toBe('from-firestore');
  });

  it('throws when no config file and no .firebaserc', async () => {
    rmSync(join(TMP_DIR, '.pi'), { recursive: true, force: true });
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('No .pi/firestore.json');
  });

  it('throws on invalid JSON', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'firestore.json'), 'not json{');
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('Invalid JSON');
  });

  it('throws on non-object JSON', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'firestore.json'), '"just a string"');
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('must be a JSON object');
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

    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('serviceAccountKeyPath');
  });

  it('throws on invalid field types', async () => {
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        projectId: 123,
        serviceAccountKeyPath: './sa.json',
      }),
    );
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('"projectId" must be a string');
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
    await expect(loadProjectConfig(TMP_DIR)).rejects.toThrow('"maxSampleSize" must be a number');
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

  it('fails with a typed error when config is missing', async () => {
    rmSync(join(TMP_DIR, '.pi'), { recursive: true, force: true });

    const result = await Effect.runPromise(
      loadProjectConfigEffect(TMP_DIR).pipe(
        Effect.provideService(FileSystem, nodeFileSystemService),
        Effect.either,
      ),
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('ConfigFileNotFound');
    }
  });

  it('fails with a typed error when config JSON is invalid', async () => {
    writeFileSync(join(TMP_DIR, '.pi', 'firestore.json'), 'not json{');

    const result = await Effect.runPromise(
      loadProjectConfigEffect(TMP_DIR).pipe(
        Effect.provideService(FileSystem, nodeFileSystemService),
        Effect.either,
      ),
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('ConfigJsonError');
    }
  });
});

describe('resolveEnvironmentConfig', () => {
  it('returns the default environment when no environment is requested', async () => {
    setupTmpDir();
    writeFileSync(
      join(TMP_DIR, '.pi', 'firestore.json'),
      JSON.stringify({
        defaultEnvironment: 'development',
        environments: {
          development: {
            projectId: 'my-project-dev',
            serviceAccountKeyPath: './dev-sa.json',
          },
          staging: {
            projectId: 'my-project-staging',
            serviceAccountKeyPath: './staging-sa.json',
          },
        },
      }),
    );

    try {
      const config = await loadProjectConfig(TMP_DIR);
      expect(resolveEnvironmentConfig(config).name).toBe('development');
      expect(resolveEnvironmentConfig(config, 'staging').projectId).toBe('my-project-staging');
      expect(() => resolveEnvironmentConfig(config, 'production')).toThrow(
        'Unknown Firestore environment',
      );
    } finally {
      teardownTmpDir();
    }
  });
});

describe('getConfigStatus', () => {
  it('reports config present with project info', () => {
    const status = getConfigStatus({
      projectId: 'my-project',
      serviceAccountKeyPath: './sa.json',
      name: 'default',
      maxSampleSize: 10,
      scanPaths: ['.'],
      scanExclude: ['node_modules'],
      defaultEnvironment: 'default',
      environments: {
        default: {
          name: 'default',
          projectId: 'my-project',
          serviceAccountKeyPath: './sa.json',
        },
      },
    });
    expect(status.hasConfig).toBe(true);
    expect(status.projectId).toBe('my-project');
    expect(status.hasServiceAccount).toBe(true);
    expect(status.defaultEnvironment).toBe('default');
    expect(status.environments).toEqual(['default']);
  });

  it('reports no config', () => {
    const status = getConfigStatus(null);
    expect(status.hasConfig).toBe(false);
    expect(status.projectId).toBeUndefined();
    expect(status.hasServiceAccount).toBe(false);
  });
});
