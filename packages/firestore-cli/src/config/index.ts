import { collectConfigCandidates, findConfigPath } from './find.js';
import { loadConfigFile } from './load.js';
import { ConfigError } from './errors.js';
import type { FirestoreProjectConfig } from './types.js';

/**
 * Resolve project config from cwd.
 * Order: first existing `.agents/firestore.json` → `.pi/firestore.json` → `.pi/firebase.json` walking up.
 */
export function resolveProjectConfig(cwd: string): FirestoreProjectConfig {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    throw new ConfigError(
      'No Firestore config found. Create `.agents/firestore.json` or `.pi/firestore.json` with defaultEnvironment and environments.<env>.{projectId, serviceAccountKeyPath}.',
      collectConfigCandidates(cwd).slice(0, 6),
    );
  }
  return loadConfigFile(configPath, cwd);
}

export { ConfigError, formatConfigError } from './errors.js';
export type { FirestoreProjectConfig, FirestoreEnvironmentConfig } from './types.js';
