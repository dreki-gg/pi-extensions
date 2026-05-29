import { Context, Effect } from 'effect';
import { initializeApp, cert, getApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { FirestoreEnvironmentConfig } from '../config.js';
import { FirebaseAdminInitError } from '../errors.js';

export const APP_NAME_PREFIX = 'pi-firestore';

export function appNameForEnvironment(environmentName: string): string {
  return `${APP_NAME_PREFIX}-${environmentName}`;
}

export interface FirebaseAdminService {
  readonly deleteAppIfExists: (appName: string) => Effect.Effect<void, never>;
  readonly initializeFirestore: (args: {
    readonly appName: string;
    readonly environment: FirestoreEnvironmentConfig;
    readonly serviceAccount: unknown;
  }) => Effect.Effect<Firestore, FirebaseAdminInitError>;
}

export class FirebaseAdmin extends Context.Tag('Firestore/FirebaseAdmin')<
  FirebaseAdmin,
  FirebaseAdminService
>() {}

export const firebaseAdminService: FirebaseAdminService = {
  deleteAppIfExists: (appName) =>
    Effect.promise(async () => {
      try {
        const existing = getApp(appName);
        await deleteApp(existing);
      } catch {
        // App does not exist yet, or deletion is not possible. Current behavior
        // intentionally ignores missing app errors before re-initialization.
      }
    }),

  initializeFirestore: ({ appName, environment, serviceAccount }) =>
    Effect.try({
      try: () => {
        const app: App = initializeApp(
          {
            credential: cert(serviceAccount as Parameters<typeof cert>[0]),
            projectId: environment.projectId,
          },
          appName,
        );

        return getFirestore(app);
      },
      catch: (cause) =>
        new FirebaseAdminInitError({
          environment: environment.name,
          projectId: environment.projectId,
          cause,
        }),
    }),
};
