import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface DatadogProjectConfig {
  service?: string;
  env?: string;
  site: string;
  defaultTags?: string[];
  defaultTimeRange: string;
  /** Default RUM application id (@application.id) for RUM event searches. */
  rumApplicationId?: string;
  /** Default service name for RUM event searches (falls back to `service`). */
  rumService?: string;
}

interface RawConfig {
  service?: unknown;
  env?: unknown;
  site?: unknown;
  defaultTags?: unknown;
  defaultTimeRange?: unknown;
  rumApplicationId?: unknown;
  rumService?: unknown;
}

const DEFAULT_CONFIG: DatadogProjectConfig = {
  site: 'datadoghq.com',
  defaultTimeRange: '1h',
};

export interface DatadogCredentials {
  apiKey: string;
  appKey: string;
}

/**
 * Reads credentials from environment variables.
 * Returns null if either key is missing.
 */
export function getCredentials(): DatadogCredentials | null {
  const apiKey = process.env.DD_API_KEY;
  const appKey = process.env.DD_APP_KEY;

  if (!apiKey || !appKey) return null;

  return { apiKey, appKey };
}

/**
 * Checks which credential keys are present (without exposing values).
 */
export function getCredentialStatus(): { hasApiKey: boolean; hasAppKey: boolean } {
  return {
    hasApiKey: Boolean(process.env.DD_API_KEY),
    hasAppKey: Boolean(process.env.DD_APP_KEY),
  };
}

/**
 * Loads and validates .pi/datadog.json from the project root.
 * Returns defaults if the file doesn't exist.
 * Throws on invalid JSON or invalid field types.
 */
export async function loadProjectConfig(cwd: string): Promise<DatadogProjectConfig> {
  const configPath = join(cwd, '.pi', 'datadog.json');

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_CONFIG };
    }
    throw new Error(`Failed to read ${configPath}: ${(err as Error).message}`);
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

  return validateConfig(parsed, configPath);
}

function validateConfig(raw: RawConfig, configPath: string): DatadogProjectConfig {
  const config: DatadogProjectConfig = { ...DEFAULT_CONFIG };

  if (raw.service !== undefined) {
    if (typeof raw.service !== 'string') {
      throw new Error(`${configPath}: "service" must be a string`);
    }
    config.service = raw.service;
  }

  if (raw.env !== undefined) {
    if (typeof raw.env !== 'string') {
      throw new Error(`${configPath}: "env" must be a string`);
    }
    config.env = raw.env;
  }

  if (raw.site !== undefined) {
    if (typeof raw.site !== 'string') {
      throw new Error(`${configPath}: "site" must be a string`);
    }
    config.site = raw.site;
  }

  if (raw.defaultTags !== undefined) {
    if (!Array.isArray(raw.defaultTags) || !raw.defaultTags.every((t) => typeof t === 'string')) {
      throw new Error(`${configPath}: "defaultTags" must be an array of strings`);
    }
    config.defaultTags = raw.defaultTags as string[];
  }

  if (raw.defaultTimeRange !== undefined) {
    if (typeof raw.defaultTimeRange !== 'string') {
      throw new Error(`${configPath}: "defaultTimeRange" must be a string`);
    }
    config.defaultTimeRange = raw.defaultTimeRange;
  }

  if (raw.rumApplicationId !== undefined) {
    if (typeof raw.rumApplicationId !== 'string') {
      throw new Error(`${configPath}: "rumApplicationId" must be a string`);
    }
    config.rumApplicationId = raw.rumApplicationId;
  }

  if (raw.rumService !== undefined) {
    if (typeof raw.rumService !== 'string') {
      throw new Error(`${configPath}: "rumService" must be a string`);
    }
    config.rumService = raw.rumService;
  }

  return config;
}
