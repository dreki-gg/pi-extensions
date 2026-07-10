import type { FirestoreEnvironmentConfig, FirestoreProjectConfig } from '../config/types.js';

export interface ResolvedAuth {
  readonly config: FirestoreProjectConfig | null;
  readonly environment: FirestoreEnvironmentConfig;
  readonly serviceAccountPath: string;
  readonly serviceAccount: unknown;
}
