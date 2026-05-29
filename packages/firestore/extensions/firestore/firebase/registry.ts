import { Context, Effect } from 'effect';
import type { Firestore } from 'firebase-admin/firestore';
import { join } from 'node:path';
import {
  type FirestoreEnvironmentConfig,
  type FirestoreProjectConfig,
  loadProjectConfigEffect,
  resolveEnvironmentConfigEffect,
} from '../config.js';
import { FileSystem } from '../effects/filesystem.js';
import { type FirestoreExtensionError, ServiceAccountJsonError } from '../errors.js';
import { appNameForEnvironment, FirebaseAdmin } from './admin.js';

export interface FirestoreRegistryResult {
  readonly config: FirestoreProjectConfig;
  readonly environment: FirestoreEnvironmentConfig;
  readonly db: Firestore;
}

export interface FirestoreRegistryService {
  readonly get: (
    cwd: string,
    environmentName?: string,
  ) => Effect.Effect<FirestoreRegistryResult, FirestoreExtensionError>;
  readonly preloadDefault: (cwd: string) => Effect.Effect<void, FirestoreExtensionError>;
  readonly loadConfig: (
    cwd: string,
  ) => Effect.Effect<FirestoreProjectConfig, FirestoreExtensionError>;
  readonly currentConfig: Effect.Effect<FirestoreProjectConfig | null>;
  readonly clear: Effect.Effect<void>;
}

export class FirestoreRegistry extends Context.Tag('Firestore/FirestoreRegistry')<
  FirestoreRegistry,
  FirestoreRegistryService
>() {}

export const makeFirestoreRegistryService: Effect.Effect<
  FirestoreRegistryService,
  never,
  FileSystem | FirebaseAdmin
> = Effect.gen(function* () {
  const fs = yield* FileSystem;
  const firebase = yield* FirebaseAdmin;

  let projectConfig: FirestoreProjectConfig | null = null;
  const dbByEnvironment = new Map<string, Firestore>();

  const loadConfig = (
    cwd: string,
  ): Effect.Effect<FirestoreProjectConfig, FirestoreExtensionError> =>
    Effect.gen(function* () {
      if (projectConfig) return projectConfig;
      projectConfig = yield* loadProjectConfigEffect(cwd).pipe(
        Effect.provideService(FileSystem, fs),
      );
      return projectConfig;
    });

  const get = (
    cwd: string,
    environmentName?: string,
  ): Effect.Effect<FirestoreRegistryResult, FirestoreExtensionError> =>
    Effect.gen(function* () {
      const config = yield* loadConfig(cwd);
      const environment = yield* resolveEnvironmentConfigEffect(config, environmentName);
      const existing = dbByEnvironment.get(environment.name);
      if (existing) return { config, environment, db: existing };

      const serviceAccountPath = join(cwd, environment.serviceAccountKeyPath);
      const serviceAccountRaw = yield* fs.readServiceAccountFileString(
        serviceAccountPath,
        environment.name,
      );
      const serviceAccount = yield* parseServiceAccountJson(
        serviceAccountRaw,
        serviceAccountPath,
        environment.name,
      );
      const appName = appNameForEnvironment(environment.name);

      yield* firebase.deleteAppIfExists(appName);
      const db = yield* firebase.initializeFirestore({ appName, environment, serviceAccount });
      dbByEnvironment.set(environment.name, db);

      return { config, environment, db };
    });

  return {
    get,
    preloadDefault: (cwd) =>
      Effect.gen(function* () {
        const config = yield* loadConfig(cwd);
        yield* get(cwd, config.defaultEnvironment);
      }),
    loadConfig,
    currentConfig: Effect.sync(() => projectConfig),
    clear: Effect.sync(() => {
      projectConfig = null;
      dbByEnvironment.clear();
    }),
  };
});

function parseServiceAccountJson(
  raw: string,
  path: string,
  environment: string,
): Effect.Effect<unknown, ServiceAccountJsonError> {
  return Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => new ServiceAccountJsonError({ path, environment, cause }),
  });
}
