import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ShapeKind } from './types.js';

export interface MiroProjectConfig {
  /** Board every tool falls back to when no boardId is passed. */
  defaultBoardId?: string;
  /** Default shape for diagram nodes / `miro_create_shape`. */
  defaultShape: ShapeKind;
}

interface RawConfig {
  defaultBoardId?: unknown;
  defaultShape?: unknown;
}

const DEFAULT_CONFIG: MiroProjectConfig = {
  defaultShape: 'round_rectangle',
};

/** Reads the access token from the environment. Returns null if missing. */
export function getCredentials(): { accessToken: string } | null {
  const accessToken = process.env.MIRO_ACCESS_TOKEN;
  if (!accessToken) return null;
  return { accessToken };
}

export function getCredentialStatus(): { hasAccessToken: boolean } {
  return { hasAccessToken: Boolean(process.env.MIRO_ACCESS_TOKEN) };
}

/**
 * Resolve the board to operate on. We NEVER create boards — every tool runs
 * against an existing board, taken from the explicit param or the configured
 * `defaultBoardId`. Throws a clear, actionable error when neither is available.
 */
export function resolveBoardId(
  param: string | undefined,
  config: MiroProjectConfig | null,
): string {
  const boardId = param?.trim() || config?.defaultBoardId?.trim();
  if (!boardId) {
    throw new Error(
      'No Miro board specified. Pass `boardId`, or set "defaultBoardId" in .pi/miro.json. ' +
        'Use `miro_list_boards` to find an existing board id.',
    );
  }
  return boardId;
}

/**
 * Loads and validates `.pi/miro.json` from the project root.
 * Returns defaults when the file is absent; throws on malformed config.
 */
export async function loadProjectConfig(cwd: string): Promise<MiroProjectConfig> {
  const configPath = join(cwd, '.pi', 'miro.json');

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

function validateConfig(raw: RawConfig, configPath: string): MiroProjectConfig {
  const config: MiroProjectConfig = { ...DEFAULT_CONFIG };

  if (raw.defaultBoardId !== undefined) {
    if (typeof raw.defaultBoardId !== 'string') {
      throw new Error(`${configPath}: "defaultBoardId" must be a string`);
    }
    config.defaultBoardId = raw.defaultBoardId;
  }

  if (raw.defaultShape !== undefined) {
    if (typeof raw.defaultShape !== 'string') {
      throw new Error(`${configPath}: "defaultShape" must be a string`);
    }
    config.defaultShape = raw.defaultShape as ShapeKind;
  }

  return config;
}
