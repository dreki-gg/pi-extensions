import type { FirestoreProjectConfig } from './resolve.js';

export interface ConfigStatus {
  readonly hasConfig: boolean;
  readonly projectId?: string;
  readonly hasServiceAccount: boolean;
  readonly defaultCollection?: string;
  readonly defaultEnvironment?: string;
  readonly environments: string[];
}

/** Returns config status without exposing sensitive paths. */
export function getConfigStatus(config: FirestoreProjectConfig | null): ConfigStatus {
  if (!config) {
    return { hasConfig: false, hasServiceAccount: false, environments: [] };
  }
  return {
    hasConfig: true,
    projectId: config.projectId,
    hasServiceAccount: Boolean(config.serviceAccountKeyPath),
    defaultCollection: config.defaultCollection,
    defaultEnvironment: config.defaultEnvironment,
    environments: Object.keys(config.environments),
  };
}
