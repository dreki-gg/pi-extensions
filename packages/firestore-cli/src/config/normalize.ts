import { ConfigError } from './errors.js';
import type { FirestoreEnvironmentConfig, RawEnvironmentConfig } from './types.js';

function serviceAccountPath(raw: RawEnvironmentConfig): string | undefined {
  if (typeof raw.serviceAccountKeyPath === 'string') return raw.serviceAccountKeyPath;
  if (typeof raw.serviceAccount === 'string') return raw.serviceAccount;
  return undefined;
}

export function validateEnvironmentFields(
  name: string,
  raw: RawEnvironmentConfig,
  configPath: string,
  fallbackProjectId?: string | null,
): FirestoreEnvironmentConfig {
  const prefix = name === 'default' ? '' : `environments.${name}.`;
  const projectId =
    typeof raw.projectId === 'string' && raw.projectId.trim()
      ? raw.projectId
      : (fallbackProjectId ?? undefined);

  if (!projectId) {
    throw new ConfigError(
      `${configPath}: "${prefix}projectId" is required (or provide a .firebaserc with a default project)`,
    );
  }
  if (typeof projectId !== 'string') {
    throw new ConfigError(`${configPath}: "${prefix}projectId" must be a string`);
  }

  const sa = serviceAccountPath(raw);
  if (!sa) {
    throw new ConfigError(`${configPath}: "${prefix}serviceAccountKeyPath" is required`);
  }

  if (raw.defaultCollection !== undefined && typeof raw.defaultCollection !== 'string') {
    throw new ConfigError(`${configPath}: "${prefix}defaultCollection" must be a string`);
  }

  return {
    name,
    projectId,
    serviceAccountKeyPath: sa,
    ...(typeof raw.defaultCollection === 'string'
      ? { defaultCollection: raw.defaultCollection }
      : {}),
  };
}

export function selectDefaultEnvironment(
  rawDefault: unknown,
  environments: Record<string, FirestoreEnvironmentConfig>,
  configPath: string,
): string {
  const names = Object.keys(environments);
  if (rawDefault === undefined) return names[0] ?? 'default';
  if (typeof rawDefault !== 'string') {
    throw new ConfigError(`${configPath}: "defaultEnvironment" must be a string`);
  }
  if (!environments[rawDefault]) {
    throw new ConfigError(
      `${configPath}: "defaultEnvironment" must match one of: ${names.join(', ')}`,
    );
  }
  return rawDefault;
}
