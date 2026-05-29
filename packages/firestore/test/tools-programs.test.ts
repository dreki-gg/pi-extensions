import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { Firestore } from 'firebase-admin/firestore';
import type { FirestoreProjectConfig } from '../extensions/firestore/config.js';
import { ConfigFileNotFound } from '../extensions/firestore/errors.js';
import {
  FirestoreRegistry,
  type FirestoreRegistryService,
} from '../extensions/firestore/firebase/registry.js';
import {
  firestoreStatusProgram,
  listCollectionsProgram,
} from '../extensions/firestore/tools/programs.js';

const config: FirestoreProjectConfig = {
  name: 'development',
  projectId: 'dev-project',
  serviceAccountKeyPath: './dev-sa.json',
  defaultCollection: 'users',
  defaultEnvironment: 'development',
  environments: {
    development: {
      name: 'development',
      projectId: 'dev-project',
      serviceAccountKeyPath: './dev-sa.json',
      defaultCollection: 'users',
    },
  },
  maxSampleSize: 10,
  scanPaths: ['.'],
  scanExclude: ['node_modules'],
};

function fakeDb(collections = [{ id: 'users', path: 'users' }]) {
  return {
    listCollections: async () => collections,
  } as unknown as Firestore;
}

function runWithRegistry<A, E>(
  program: Effect.Effect<A, E, FirestoreRegistry>,
  registry: FirestoreRegistryService,
) {
  return Effect.runPromise(program.pipe(Effect.provideService(FirestoreRegistry, registry)));
}

describe('Firestore tool programs', () => {
  it('listCollectionsProgram returns formatted text and environment details', async () => {
    const registry: FirestoreRegistryService = {
      get: () =>
        Effect.succeed({
          config,
          environment: config.environments.development,
          db: fakeDb(),
        }),
      preloadDefault: () => Effect.void,
      loadConfig: () => Effect.succeed(config),
      currentConfig: Effect.succeed(config),
      clear: Effect.void,
    };

    const result = await runWithRegistry(listCollectionsProgram('/repo', {}), registry);

    expect(result.text).toContain('users');
    expect(result.details.environment).toBe('development');
    expect(result.details.projectId).toBe('dev-project');
    expect(result.details.count).toBe(1);
  });

  it('firestoreStatusProgram reports missing config without failing', async () => {
    const registry: FirestoreRegistryService = {
      get: () => Effect.die('unexpected get'),
      preloadDefault: () => Effect.void,
      loadConfig: () =>
        Effect.fail(
          new ConfigFileNotFound({
            cwd: '/repo',
            candidates: ['/repo/.pi/firestore.json', '/repo/.pi/firebase.json'],
          }),
        ),
      currentConfig: Effect.succeed(null),
      clear: Effect.void,
    };

    const lines = await runWithRegistry(firestoreStatusProgram('/repo'), registry);

    expect(lines.join('\n')).toContain('Config: ❌ Missing');
    expect(lines.join('\n')).toContain('Connection Error: No .pi/firestore.json');
  });
});
