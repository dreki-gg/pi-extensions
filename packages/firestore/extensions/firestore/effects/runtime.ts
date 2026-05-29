import { Effect, Layer } from 'effect';
import { FileSystem, nodeFileSystemService } from './filesystem.js';
import { FirebaseAdmin, firebaseAdminService } from '../firebase/admin.js';
import { FirestoreRegistry, makeFirestoreRegistryService } from '../firebase/registry.js';

/**
 * Builds the live Effect layer for the extension.
 *
 * Important: call this once inside `firestoreExtension(pi)`. The registry
 * service closes over the config/db caches, so recreating this layer per tool
 * call would discard lazy Firestore client caching.
 */
export function makeRuntimeLayer() {
  const registryService = Effect.runSync(
    makeFirestoreRegistryService.pipe(
      Effect.provideService(FileSystem, nodeFileSystemService),
      Effect.provideService(FirebaseAdmin, firebaseAdminService),
    ),
  );

  return Layer.mergeAll(
    Layer.succeed(FileSystem, nodeFileSystemService),
    Layer.succeed(FirebaseAdmin, firebaseAdminService),
    Layer.succeed(FirestoreRegistry, registryService),
  );
}
