import { accessSync, constants, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { ConfigError } from '../config/errors.js';
import type { FirestoreEnvironmentConfig } from '../config/types.js';
import type { ResolvedAuth } from './types.js';

export function resolveSaPath(configDir: string, relativeOrAbsolute: string): string {
  return isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : resolve(configDir, relativeOrAbsolute);
}

export function readServiceAccount(path: string, environment: string): unknown {
  try {
    accessSync(path, constants.R_OK);
  } catch {
    throw new ConfigError(
      `Failed to read service account for environment "${environment}" at ${path}. Check that the file exists and is readable.`,
      [path],
    );
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    throw new ConfigError(
      `Invalid JSON in service account for environment "${environment}" at ${path}: ${msg}`,
      [path],
    );
  }
}

function projectIdFromSa(serviceAccount: unknown): string | undefined {
  if (typeof serviceAccount !== 'object' || serviceAccount === null) return undefined;
  const id = (serviceAccount as { project_id?: unknown }).project_id;
  return typeof id === 'string' ? id : undefined;
}

export function fromGoogleApplicationCredentials(
  cwd: string,
  envName: string,
): ResolvedAuth | null {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!gac) return null;
  const path = isAbsolute(gac) ? gac : resolve(cwd, gac);
  const serviceAccount = readServiceAccount(path, envName);
  const projectId =
    projectIdFromSa(serviceAccount) ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'unknown';
  const environment: FirestoreEnvironmentConfig = {
    name: envName,
    projectId,
    serviceAccountKeyPath: path,
  };
  return { config: null, environment, serviceAccountPath: path, serviceAccount };
}
