import { initializeApp, cert, getApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { ResolvedAuth } from './types.js';

const APP_PREFIX = 'firestore-cli';

export function appNameFor(environmentName: string): string {
  return `${APP_PREFIX}-${environmentName}`;
}

async function deleteAppIfExists(appName: string): Promise<void> {
  try {
    const existing = getApp(appName);
    await deleteApp(existing);
  } catch {
    // App does not exist yet.
  }
}

/** Initialize (or re-initialize) a Firestore client for the resolved auth. */
export async function createFirestore(auth: ResolvedAuth): Promise<Firestore> {
  const appName = appNameFor(auth.environment.name);
  await deleteAppIfExists(appName);
  const app: App = initializeApp(
    {
      credential: cert(auth.serviceAccount as Parameters<typeof cert>[0]),
      projectId: auth.environment.projectId,
    },
    appName,
  );
  return getFirestore(app);
}
