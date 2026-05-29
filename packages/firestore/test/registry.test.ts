import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { Firestore } from 'firebase-admin/firestore';
import { join } from 'node:path';
import { FileSystem, type FileSystemService } from '../extensions/firestore/effects/filesystem.js';
import { ConfigReadError, ServiceAccountReadError } from '../extensions/firestore/errors.js';
import {
  FirebaseAdmin,
  type FirebaseAdminService,
} from '../extensions/firestore/firebase/admin.js';
import { makeFirestoreRegistryService } from '../extensions/firestore/firebase/registry.js';

const CWD = '/repo';

function enoent(path: string) {
  return Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), {
    code: 'ENOENT',
  });
}

function makeFs(files: Record<string, string>) {
  const serviceAccountReads: string[] = [];
  const fs: FileSystemService = {
    readConfigFileString: (path) => {
      const value = files[path];
      if (value === undefined) {
        return Effect.fail(new ConfigReadError({ path, cause: enoent(path) }));
      }
      return Effect.succeed(value);
    },
    readServiceAccountFileString: (path, environment) => {
      serviceAccountReads.push(path);
      const value = files[path];
      if (value === undefined) {
        return Effect.fail(new ServiceAccountReadError({ path, environment, cause: enoent(path) }));
      }
      return Effect.succeed(value);
    },
    readFileString: (path) => Effect.succeed(files[path] ?? ''),
    readDirectory: () => Effect.succeed([]),
  };

  return { fs, serviceAccountReads };
}

function makeFirebase() {
  const initialized: string[] = [];
  const deleted: string[] = [];
  const firebase: FirebaseAdminService = {
    deleteAppIfExists: (appName) => Effect.sync(() => void deleted.push(appName)),
    initializeFirestore: ({ appName }) =>
      Effect.sync(() => {
        initialized.push(appName);
        return { appName } as unknown as Firestore;
      }),
  };
  return { firebase, initialized, deleted };
}

async function makeRegistry(fs: FileSystemService, firebase: FirebaseAdminService) {
  return Effect.runPromise(
    makeFirestoreRegistryService.pipe(
      Effect.provideService(FileSystem, fs),
      Effect.provideService(FirebaseAdmin, firebase),
    ),
  );
}

describe('FirestoreRegistry', () => {
  it('initializes and caches a requested environment', async () => {
    const { fs } = makeFs({
      [join(CWD, '.pi', 'firestore.json')]: JSON.stringify({
        defaultEnvironment: 'development',
        environments: {
          development: { projectId: 'dev-project', serviceAccountKeyPath: './dev-sa.json' },
          staging: { projectId: 'staging-project', serviceAccountKeyPath: './staging-sa.json' },
        },
      }),
      [join(CWD, './staging-sa.json')]: JSON.stringify({ client_email: 'test@example.com' }),
    });
    const { firebase, initialized, deleted } = makeFirebase();
    const registry = await makeRegistry(fs, firebase);

    const first = await Effect.runPromise(registry.get(CWD, 'staging'));
    const second = await Effect.runPromise(registry.get(CWD, 'staging'));

    expect(first.environment.name).toBe('staging');
    expect(first.db).toBe(second.db);
    expect(initialized).toEqual(['pi-firestore-staging']);
    expect(deleted).toEqual(['pi-firestore-staging']);
  });

  it('initializes separate environments separately', async () => {
    const { fs } = makeFs({
      [join(CWD, '.pi', 'firestore.json')]: JSON.stringify({
        defaultEnvironment: 'development',
        environments: {
          development: { projectId: 'dev-project', serviceAccountKeyPath: './dev-sa.json' },
          staging: { projectId: 'staging-project', serviceAccountKeyPath: './staging-sa.json' },
        },
      }),
      [join(CWD, './dev-sa.json')]: JSON.stringify({ client_email: 'dev@example.com' }),
      [join(CWD, './staging-sa.json')]: JSON.stringify({ client_email: 'staging@example.com' }),
    });
    const { firebase, initialized } = makeFirebase();
    const registry = await makeRegistry(fs, firebase);

    await Effect.runPromise(registry.get(CWD));
    await Effect.runPromise(registry.get(CWD, 'staging'));

    expect(initialized).toEqual(['pi-firestore-development', 'pi-firestore-staging']);
  });

  it('clear resets the db cache', async () => {
    const { fs } = makeFs({
      [join(CWD, '.pi', 'firestore.json')]: JSON.stringify({
        projectId: 'project',
        serviceAccountKeyPath: './sa.json',
      }),
      [join(CWD, './sa.json')]: JSON.stringify({ client_email: 'test@example.com' }),
    });
    const { firebase, initialized } = makeFirebase();
    const registry = await makeRegistry(fs, firebase);

    await Effect.runPromise(registry.get(CWD));
    await Effect.runPromise(registry.clear);
    await Effect.runPromise(registry.get(CWD));

    expect(initialized).toEqual(['pi-firestore-default', 'pi-firestore-default']);
  });

  it('fails unknown environments before reading service account files', async () => {
    const { fs, serviceAccountReads } = makeFs({
      [join(CWD, '.pi', 'firestore.json')]: JSON.stringify({
        defaultEnvironment: 'development',
        environments: {
          development: { projectId: 'dev-project', serviceAccountKeyPath: './dev-sa.json' },
        },
      }),
    });
    const { firebase } = makeFirebase();
    const registry = await makeRegistry(fs, firebase);

    const result = await Effect.runPromise(registry.get(CWD, 'production').pipe(Effect.either));

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') expect(result.left._tag).toBe('UnknownEnvironmentError');
    expect(serviceAccountReads).toEqual([]);
  });

  it('surfaces invalid service account JSON as a typed error', async () => {
    const { fs } = makeFs({
      [join(CWD, '.pi', 'firestore.json')]: JSON.stringify({
        projectId: 'project',
        serviceAccountKeyPath: './sa.json',
      }),
      [join(CWD, './sa.json')]: 'not json',
    });
    const { firebase } = makeFirebase();
    const registry = await makeRegistry(fs, firebase);

    const result = await Effect.runPromise(registry.get(CWD).pipe(Effect.either));

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') expect(result.left._tag).toBe('ServiceAccountJsonError');
  });
});
