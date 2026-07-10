import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ConfigError } from './errors.js';
import { readFirebaseRcProjectId } from './firebaserc.js';
import { selectDefaultEnvironment, validateEnvironmentFields } from './normalize.js';
import type { FirestoreProjectConfig, RawConfig } from './types.js';

const DEFAULTS = {
  maxSampleSize: 10,
  scanPaths: ['.'] as string[],
  scanExclude: ['node_modules', 'dist', '.git'] as string[],
};

export function loadConfigFile(configPath: string, cwd: string): FirestoreProjectConfig {
  let rawText: string;
  try {
    rawText = readFileSync(configPath, 'utf-8');
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    throw new ConfigError(`Failed to read ${configPath}: ${msg}`, [configPath]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ConfigError(`Invalid JSON in ${configPath}`, [configPath]);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError(`${configPath}: must be a JSON object`, [configPath]);
  }

  return normalizeConfig(parsed as RawConfig, configPath, cwd);
}

function normalizeConfig(raw: RawConfig, configPath: string, cwd: string): FirestoreProjectConfig {
  if (raw.maxSampleSize !== undefined && typeof raw.maxSampleSize !== 'number') {
    throw new ConfigError(`${configPath}: "maxSampleSize" must be a number`);
  }
  const maxSampleSize = raw.maxSampleSize ?? DEFAULTS.maxSampleSize;
  const scanPaths = Array.isArray(raw.scanPaths) ? (raw.scanPaths as string[]) : DEFAULTS.scanPaths;
  const scanExclude = Array.isArray(raw.scanExclude)
    ? (raw.scanExclude as string[])
    : DEFAULTS.scanExclude;

  const firebaseProject = readFirebaseRcProjectId(cwd);
  const environments = buildEnvironments(raw, configPath, firebaseProject);
  const defaultEnvironment = selectDefaultEnvironment(
    raw.defaultEnvironment,
    environments,
    configPath,
  );
  const active = environments[defaultEnvironment];

  return {
    ...active,
    maxSampleSize,
    scanPaths,
    scanExclude,
    defaultEnvironment,
    environments,
    configPath,
    configDir: dirname(dirname(configPath)),
  };
}

function buildEnvironments(
  raw: RawConfig,
  configPath: string,
  firebaseProject: string | null,
): FirestoreProjectConfig['environments'] {
  if (raw.environments === undefined) {
    return {
      default: validateEnvironmentFields('default', raw, configPath, firebaseProject),
    };
  }
  if (
    typeof raw.environments !== 'object' ||
    raw.environments === null ||
    Array.isArray(raw.environments)
  ) {
    throw new ConfigError(`${configPath}: "environments" must be an object`);
  }
  const entries = Object.entries(raw.environments as Record<string, unknown>);
  if (entries.length === 0) {
    throw new ConfigError(`${configPath}: "environments" must not be empty`);
  }
  const environments: FirestoreProjectConfig['environments'] = {};
  for (const [name, value] of entries) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ConfigError(`${configPath}: "environments.${name}" must be an object`);
    }
    environments[name] = validateEnvironmentFields(name, value, configPath, firebaseProject);
  }
  return environments;
}
