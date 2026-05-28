import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface FirestoreProjectConfig {
  projectId: string;
  serviceAccountKeyPath: string;
  defaultCollection?: string;
  maxSampleSize: number;
  scanPaths: string[];
  scanExclude: string[];
}

interface RawConfig {
  projectId?: unknown;
  serviceAccountKeyPath?: unknown;
  defaultCollection?: unknown;
  maxSampleSize?: unknown;
  scanPaths?: unknown;
  scanExclude?: unknown;
}

const DEFAULTS = {
  maxSampleSize: 10,
  scanPaths: ['.'],
  scanExclude: ['node_modules', 'dist', '.git'],
} as const;

/**
 * Reads `.firebaserc` to extract the default project ID.
 * Returns null if file doesn't exist or has no default project.
 */
async function readFirebaseRc(cwd: string): Promise<string | null> {
  try {
    const raw = await readFile(join(cwd, '.firebaserc'), 'utf-8');
    const parsed = JSON.parse(raw) as { projects?: { default?: string } };
    return parsed?.projects?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Loads and validates `.pi/firestore.json` from the project root.
 * Falls back to `.firebaserc` for projectId when not specified in config.
 * Throws on missing config, invalid JSON, or invalid field types.
 */
export async function loadProjectConfig(
  cwd: string,
): Promise<FirestoreProjectConfig> {
  const configPath = join(cwd, '.pi', 'firestore.json');

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      throw new Error(
        'No .pi/firestore.json found. Create one with at least projectId and serviceAccountKeyPath.',
      );
    }
    throw new Error(
      `Failed to read ${configPath}: ${(err as Error).message}`,
    );
  }

  let parsed: RawConfig;
  try {
    parsed = JSON.parse(raw) as RawConfig;
  } catch {
    throw new Error(`Invalid JSON in ${configPath}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${configPath} must be a JSON object`);
  }

  return validateConfig(parsed, configPath, cwd);
}

async function validateConfig(
  raw: RawConfig,
  configPath: string,
  cwd: string,
): Promise<FirestoreProjectConfig> {
  // projectId — required, with .firebaserc fallback
  let projectId: string | undefined;
  if (raw.projectId !== undefined) {
    if (typeof raw.projectId !== 'string') {
      throw new Error(`${configPath}: "projectId" must be a string`);
    }
    projectId = raw.projectId;
  } else {
    const fromRc = await readFirebaseRc(cwd);
    if (fromRc) {
      projectId = fromRc;
    } else {
      throw new Error(
        `${configPath}: "projectId" is required (or provide a .firebaserc with a default project)`,
      );
    }
  }

  // serviceAccountKeyPath — required
  if (raw.serviceAccountKeyPath === undefined) {
    throw new Error(
      `${configPath}: "serviceAccountKeyPath" is required`,
    );
  }
  if (typeof raw.serviceAccountKeyPath !== 'string') {
    throw new Error(
      `${configPath}: "serviceAccountKeyPath" must be a string`,
    );
  }

  const config: FirestoreProjectConfig = {
    projectId,
    serviceAccountKeyPath: raw.serviceAccountKeyPath,
    maxSampleSize: DEFAULTS.maxSampleSize,
    scanPaths: [...DEFAULTS.scanPaths],
    scanExclude: [...DEFAULTS.scanExclude],
  };

  // defaultCollection — optional
  if (raw.defaultCollection !== undefined) {
    if (typeof raw.defaultCollection !== 'string') {
      throw new Error(
        `${configPath}: "defaultCollection" must be a string`,
      );
    }
    config.defaultCollection = raw.defaultCollection;
  }

  // maxSampleSize — optional
  if (raw.maxSampleSize !== undefined) {
    if (typeof raw.maxSampleSize !== 'number') {
      throw new Error(
        `${configPath}: "maxSampleSize" must be a number`,
      );
    }
    config.maxSampleSize = raw.maxSampleSize;
  }

  // scanPaths — optional
  if (raw.scanPaths !== undefined) {
    if (
      !Array.isArray(raw.scanPaths) ||
      !raw.scanPaths.every((p) => typeof p === 'string')
    ) {
      throw new Error(
        `${configPath}: "scanPaths" must be an array of strings`,
      );
    }
    config.scanPaths = raw.scanPaths as string[];
  }

  // scanExclude — optional
  if (raw.scanExclude !== undefined) {
    if (
      !Array.isArray(raw.scanExclude) ||
      !raw.scanExclude.every((p) => typeof p === 'string')
    ) {
      throw new Error(
        `${configPath}: "scanExclude" must be an array of strings`,
      );
    }
    config.scanExclude = raw.scanExclude as string[];
  }

  return config;
}

export interface ConfigStatus {
  hasConfig: boolean;
  projectId?: string;
  hasServiceAccount: boolean;
  defaultCollection?: string;
}

/**
 * Returns config status without exposing sensitive paths.
 */
export function getConfigStatus(
  config: FirestoreProjectConfig | null,
): ConfigStatus {
  if (!config) {
    return { hasConfig: false, hasServiceAccount: false };
  }
  return {
    hasConfig: true,
    projectId: config.projectId,
    hasServiceAccount: Boolean(config.serviceAccountKeyPath),
    defaultCollection: config.defaultCollection,
  };
}
