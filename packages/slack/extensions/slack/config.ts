import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Project config (.pi/slack.json)
// ---------------------------------------------------------------------------

export interface SlackProjectConfig {
  /** Default channel ID to read from. */
  defaultChannel?: string;
  /** Max messages per request (default 50). */
  messageLimit: number;
}

interface RawConfig {
  defaultChannel?: unknown;
  messageLimit?: unknown;
}

const DEFAULT_CONFIG: SlackProjectConfig = {
  messageLimit: 50,
};

export async function loadProjectConfig(cwd: string): Promise<SlackProjectConfig> {
  const configPath = join(cwd, '.pi', 'slack.json');

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

function validateConfig(raw: RawConfig, configPath: string): SlackProjectConfig {
  const config: SlackProjectConfig = { ...DEFAULT_CONFIG };

  if (raw.defaultChannel !== undefined) {
    if (typeof raw.defaultChannel !== 'string') {
      throw new Error(`${configPath}: "defaultChannel" must be a string`);
    }
    config.defaultChannel = raw.defaultChannel;
  }

  if (raw.messageLimit !== undefined) {
    if (typeof raw.messageLimit !== 'number' || raw.messageLimit < 1 || raw.messageLimit > 999) {
      throw new Error(`${configPath}: "messageLimit" must be a number between 1 and 999`);
    }
    config.messageLimit = raw.messageLimit;
  }

  return config;
}

// ---------------------------------------------------------------------------
// Credentials from environment
// ---------------------------------------------------------------------------

export interface SlackCredentials {
  botToken: string;
  userToken?: string;
}

export function getCredentials(): SlackCredentials | null {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) return null;

  const userToken = process.env.SLACK_USER_TOKEN || undefined;
  return { botToken, userToken };
}

export function getCredentialStatus(): {
  hasBotToken: boolean;
  hasUserToken: boolean;
} {
  return {
    hasBotToken: Boolean(process.env.SLACK_BOT_TOKEN),
    hasUserToken: Boolean(process.env.SLACK_USER_TOKEN),
  };
}
