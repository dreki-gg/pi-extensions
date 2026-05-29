import { Effect } from 'effect';
import { UnknownEnvironmentError } from '../errors.js';

export interface FirestoreEnvironmentConfig {
  readonly name: string;
  readonly projectId: string;
  readonly serviceAccountKeyPath: string;
  readonly defaultCollection?: string;
}

export interface FirestoreProjectConfig extends FirestoreEnvironmentConfig {
  readonly defaultEnvironment: string;
  readonly environments: Record<string, FirestoreEnvironmentConfig>;
  readonly maxSampleSize: number;
  readonly scanPaths: string[];
  readonly scanExclude: string[];
}

export function resolveEnvironmentConfigEffect(
  config: FirestoreProjectConfig,
  environmentName?: string,
): Effect.Effect<FirestoreEnvironmentConfig, UnknownEnvironmentError> {
  const selected = environmentName ?? config.defaultEnvironment;
  const environment = config.environments[selected];
  if (!environment) {
    return Effect.fail(
      new UnknownEnvironmentError({
        requested: selected,
        available: Object.keys(config.environments),
      }),
    );
  }
  return Effect.succeed(environment);
}

export function resolveEnvironmentConfig(
  config: FirestoreProjectConfig,
  environmentName?: string,
): FirestoreEnvironmentConfig {
  const selected = environmentName ?? config.defaultEnvironment;
  const environment = config.environments[selected];
  if (!environment) {
    throw new Error(
      `Unknown Firestore environment "${selected}". Available environments: ${Object.keys(config.environments).join(', ')}`,
    );
  }
  return environment;
}
