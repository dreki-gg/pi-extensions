import { ConfigError, resolveProjectConfig } from '../config/index.js';
import type { FirestoreProjectConfig } from '../config/types.js';
import { fromGoogleApplicationCredentials, readServiceAccount, resolveSaPath } from './paths.js';
import type { ResolvedAuth } from './types.js';

export type { ResolvedAuth } from './types.js';

/**
 * Resolve auth for a command.
 * 1. Load config (`.agents` → `.pi`, walk up) when present.
 * 2. Select environment via `--env` or `defaultEnvironment`.
 * 3. Read service account from config path; fall back to GOOGLE_APPLICATION_CREDENTIALS.
 */
export function resolveAuth(cwd: string, environmentName?: string): ResolvedAuth {
  let config: FirestoreProjectConfig | null = null;
  try {
    config = resolveProjectConfig(cwd);
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    const gac = fromGoogleApplicationCredentials(cwd, environmentName ?? 'default');
    if (gac) return gac;
    throw err;
  }

  const selected = environmentName ?? config.defaultEnvironment;
  const environment = config.environments[selected];
  if (!environment) {
    throw new ConfigError(
      `Unknown Firestore environment "${selected}". Available environments: ${Object.keys(config.environments).join(', ')}`,
    );
  }

  const saPath = resolveSaPath(config.configDir, environment.serviceAccountKeyPath);
  try {
    const serviceAccount = readServiceAccount(saPath, environment.name);
    return { config, environment, serviceAccountPath: saPath, serviceAccount };
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw err;
    const fallback = fromGoogleApplicationCredentials(cwd, environment.name);
    if (!fallback) throw err;
    return {
      ...fallback,
      config,
      environment: { ...environment, serviceAccountKeyPath: fallback.serviceAccountPath },
    };
  }
}
