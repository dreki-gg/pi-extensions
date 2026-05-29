import { Effect, Schema } from 'effect';
import { join } from 'node:path';
import {
  ConfigFileNotFound,
  ConfigJsonError,
  ConfigReadError,
  ConfigValidationError,
  toNativeError,
} from '../errors.js';
import { FileSystem, nodeFileSystemService } from '../effects/filesystem.js';
import { RawConfigSchema, type RawConfig, type RawEnvironmentConfig } from './schema.js';
import type { FirestoreEnvironmentConfig, FirestoreProjectConfig } from './resolve.js';

const DEFAULTS = {
  maxSampleSize: 10,
  scanPaths: ['.'],
  scanExclude: ['node_modules', 'dist', '.git'],
} as const;

const CONFIG_FILENAMES = ['firestore.json', 'firebase.json'] as const;

interface SharedConfig {
  maxSampleSize: number;
  scanPaths: string[];
  scanExclude: string[];
}

export function loadProjectConfigEffect(
  cwd: string,
): Effect.Effect<
  FirestoreProjectConfig,
  ConfigFileNotFound | ConfigReadError | ConfigJsonError | ConfigValidationError,
  FileSystem
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const candidates = CONFIG_FILENAMES.map((filename) => join(cwd, '.pi', filename));

    let raw: string | undefined;
    let configPath: string | undefined;

    for (const candidate of candidates) {
      const result = yield* fs.readConfigFileString(candidate).pipe(Effect.either);
      if (result._tag === 'Right') {
        raw = result.right;
        configPath = candidate;
        break;
      }
      if (isFileNotFound(result.left.cause)) continue;
      return yield* result.left;
    }

    if (!raw || !configPath) {
      return yield* new ConfigFileNotFound({ cwd, candidates });
    }

    const parsed = yield* parseConfigJson(raw, configPath);
    return yield* normalizeConfig(parsed, configPath, cwd);
  });
}

export async function loadProjectConfig(cwd: string): Promise<FirestoreProjectConfig> {
  return Effect.runPromise(
    loadProjectConfigEffect(cwd).pipe(
      Effect.provideService(FileSystem, nodeFileSystemService),
      Effect.mapError(toNativeError),
    ),
  );
}

function parseConfigJson(
  raw: string,
  configPath: string,
): Effect.Effect<RawConfig, ConfigJsonError | ConfigValidationError> {
  return Effect.gen(function* () {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return yield* new ConfigJsonError({ path: configPath, cause });
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return yield* new ConfigValidationError({
        path: configPath,
        reason: 'must be a JSON object',
      });
    }

    return yield* Schema.decodeUnknown(RawConfigSchema)(parsed).pipe(
      Effect.mapError(
        (cause) =>
          new ConfigValidationError({
            path: configPath,
            reason: String(cause),
          }),
      ),
    );
  });
}

function normalizeConfig(
  raw: RawConfig,
  configPath: string,
  cwd: string,
): Effect.Effect<FirestoreProjectConfig, ConfigValidationError, FileSystem> {
  return Effect.gen(function* () {
    const base = yield* Effect.try({
      try: () => validateSharedConfig(raw, configPath),
      catch: (error) => error as ConfigValidationError,
    });
    const environments = yield* validateEnvironments(raw, configPath, cwd);
    const defaultEnvironment = yield* Effect.try({
      try: () => selectDefaultEnvironment(raw.defaultEnvironment, environments, configPath),
      catch: (error) => error as ConfigValidationError,
    });
    const active = environments[defaultEnvironment];

    if (!active) {
      return yield* validationError(
        configPath,
        `"defaultEnvironment" must match one of: ${Object.keys(environments).join(', ')}`,
      );
    }

    return {
      ...active,
      ...base,
      defaultEnvironment,
      environments,
    };
  });
}

function validateSharedConfig(raw: RawConfig, configPath: string): SharedConfig {
  const config: SharedConfig = {
    maxSampleSize: DEFAULTS.maxSampleSize,
    scanPaths: [...DEFAULTS.scanPaths],
    scanExclude: [...DEFAULTS.scanExclude],
  };

  if (raw.maxSampleSize !== undefined) {
    if (typeof raw.maxSampleSize !== 'number') {
      throw new ConfigValidationError({
        path: configPath,
        reason: '"maxSampleSize" must be a number',
      });
    }
    config.maxSampleSize = raw.maxSampleSize;
  }

  if (raw.scanPaths !== undefined) {
    if (!Array.isArray(raw.scanPaths) || !raw.scanPaths.every((p) => typeof p === 'string')) {
      throw new ConfigValidationError({
        path: configPath,
        reason: '"scanPaths" must be an array of strings',
      });
    }
    config.scanPaths = raw.scanPaths;
  }

  if (raw.scanExclude !== undefined) {
    if (!Array.isArray(raw.scanExclude) || !raw.scanExclude.every((p) => typeof p === 'string')) {
      throw new ConfigValidationError({
        path: configPath,
        reason: '"scanExclude" must be an array of strings',
      });
    }
    config.scanExclude = raw.scanExclude;
  }

  return config;
}

function validateEnvironments(
  raw: RawConfig,
  configPath: string,
  cwd: string,
): Effect.Effect<Record<string, FirestoreEnvironmentConfig>, ConfigValidationError, FileSystem> {
  if (raw.environments !== undefined) {
    return Effect.try({
      try: () => validateEnvironmentMap(raw.environments, configPath),
      catch: (error) => error as ConfigValidationError,
    });
  }

  return Effect.gen(function* () {
    const legacy = yield* validateLegacyEnvironment(raw, configPath, cwd);
    return { default: legacy };
  });
}

function validateLegacyEnvironment(
  raw: RawEnvironmentConfig,
  configPath: string,
  cwd: string,
): Effect.Effect<FirestoreEnvironmentConfig, ConfigValidationError, FileSystem> {
  return Effect.gen(function* () {
    let projectId: string | undefined;
    if (raw.projectId !== undefined) {
      if (typeof raw.projectId !== 'string') {
        return yield* validationError(configPath, '"projectId" must be a string');
      }
      projectId = raw.projectId;
    } else {
      const fromRc = yield* readFirebaseRc(cwd);
      if (fromRc) {
        projectId = fromRc;
      } else {
        return yield* validationError(
          configPath,
          '"projectId" is required (or provide a .firebaserc with a default project)',
        );
      }
    }

    return yield* Effect.try({
      try: () => validateEnvironmentFields('default', { ...raw, projectId }, configPath),
      catch: (error) => error as ConfigValidationError,
    });
  });
}

function validateEnvironmentMap(
  rawEnvironments: unknown,
  configPath: string,
): Record<string, FirestoreEnvironmentConfig> {
  if (
    typeof rawEnvironments !== 'object' ||
    rawEnvironments === null ||
    Array.isArray(rawEnvironments)
  ) {
    throw new ConfigValidationError({
      path: configPath,
      reason: '"environments" must be an object',
    });
  }

  const entries = Object.entries(rawEnvironments as Record<string, unknown>);
  if (entries.length === 0) {
    throw new ConfigValidationError({
      path: configPath,
      reason: '"environments" must not be empty',
    });
  }

  const environments: Record<string, FirestoreEnvironmentConfig> = {};
  for (const [name, value] of entries) {
    if (!name.trim()) {
      throw new ConfigValidationError({
        path: configPath,
        reason: 'environment names must not be empty',
      });
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ConfigValidationError({
        path: configPath,
        reason: `"environments.${name}" must be an object`,
      });
    }
    environments[name] = validateEnvironmentFields(name, value as RawEnvironmentConfig, configPath);
  }

  return environments;
}

function validateEnvironmentFields(
  name: string,
  raw: RawEnvironmentConfig,
  configPath: string,
): FirestoreEnvironmentConfig {
  const prefix = name === 'default' ? '' : `environments.${name}.`;

  if (raw.projectId === undefined) {
    throw new ConfigValidationError({
      path: configPath,
      reason: `"${prefix}projectId" is required`,
    });
  }
  if (typeof raw.projectId !== 'string') {
    throw new ConfigValidationError({
      path: configPath,
      reason: `"${prefix}projectId" must be a string`,
    });
  }

  if (raw.serviceAccountKeyPath === undefined) {
    throw new ConfigValidationError({
      path: configPath,
      reason: `"${prefix}serviceAccountKeyPath" is required`,
    });
  }
  if (typeof raw.serviceAccountKeyPath !== 'string') {
    throw new ConfigValidationError({
      path: configPath,
      reason: `"${prefix}serviceAccountKeyPath" must be a string`,
    });
  }

  const environment: {
    name: string;
    projectId: string;
    serviceAccountKeyPath: string;
    defaultCollection?: string;
  } = {
    name,
    projectId: raw.projectId,
    serviceAccountKeyPath: raw.serviceAccountKeyPath,
  };

  if (raw.defaultCollection !== undefined) {
    if (typeof raw.defaultCollection !== 'string') {
      throw new ConfigValidationError({
        path: configPath,
        reason: `"${prefix}defaultCollection" must be a string`,
      });
    }
    environment.defaultCollection = raw.defaultCollection;
  }

  return environment;
}

function selectDefaultEnvironment(
  rawDefaultEnvironment: unknown,
  environments: Record<string, FirestoreEnvironmentConfig>,
  configPath: string,
): string {
  const names = Object.keys(environments);

  if (rawDefaultEnvironment === undefined) {
    return names[0] ?? 'default';
  }

  if (typeof rawDefaultEnvironment !== 'string') {
    throw new ConfigValidationError({
      path: configPath,
      reason: '"defaultEnvironment" must be a string',
    });
  }

  if (!environments[rawDefaultEnvironment]) {
    throw new ConfigValidationError({
      path: configPath,
      reason: `"defaultEnvironment" must match one of: ${names.join(', ')}`,
    });
  }

  return rawDefaultEnvironment;
}

function readFirebaseRc(cwd: string): Effect.Effect<string | null, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const raw = yield* fs.readConfigFileString(join(cwd, '.firebaserc')).pipe(Effect.either);
    if (raw._tag === 'Left') return null;

    try {
      const parsed = JSON.parse(raw.right) as { projects?: { default?: string } };
      return parsed?.projects?.default ?? null;
    } catch {
      return null;
    }
  });
}

function validationError(
  path: string,
  reason: string,
): Effect.Effect<never, ConfigValidationError> {
  return Effect.fail(new ConfigValidationError({ path, reason }));
}

function isFileNotFound(cause: unknown): boolean {
  return (
    cause instanceof Error && 'code' in cause && (cause as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
