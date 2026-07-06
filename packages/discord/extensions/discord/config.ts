import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Project config (.pi/discord.json)
// ---------------------------------------------------------------------------

export interface DiscordProjectConfig {
  /** Default guild (server) ID to list channels from. */
  defaultGuild?: string;
  /** Default channel ID to read from. */
  defaultChannel?: string;
  /** Max messages per request (default 50). */
  messageLimit: number;
}

interface RawConfig {
  defaultGuild?: unknown;
  defaultChannel?: unknown;
  messageLimit?: unknown;
}

const DEFAULT_CONFIG: DiscordProjectConfig = {
  messageLimit: 50,
};

export async function loadProjectConfig(cwd: string): Promise<DiscordProjectConfig> {
  const configPath = join(cwd, '.pi', 'discord.json');

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

function validateConfig(raw: RawConfig, configPath: string): DiscordProjectConfig {
  const config: DiscordProjectConfig = { ...DEFAULT_CONFIG };

  if (raw.defaultGuild !== undefined) {
    if (typeof raw.defaultGuild !== 'string') {
      throw new Error(`${configPath}: "defaultGuild" must be a string`);
    }
    config.defaultGuild = raw.defaultGuild;
  }

  if (raw.defaultChannel !== undefined) {
    if (typeof raw.defaultChannel !== 'string') {
      throw new Error(`${configPath}: "defaultChannel" must be a string`);
    }
    config.defaultChannel = raw.defaultChannel;
  }

  if (raw.messageLimit !== undefined) {
    if (typeof raw.messageLimit !== 'number' || raw.messageLimit < 1 || raw.messageLimit > 100) {
      throw new Error(`${configPath}: "messageLimit" must be a number between 1 and 100`);
    }
    config.messageLimit = raw.messageLimit;
  }

  return config;
}

// ---------------------------------------------------------------------------
// Credentials from environment
// ---------------------------------------------------------------------------

export interface DiscordCredentials {
  botToken: string;
}

export function getCredentials(): DiscordCredentials | null {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return null;
  return { botToken };
}

export function getCredentialStatus(): { hasBotToken: boolean } {
  return { hasBotToken: Boolean(process.env.DISCORD_BOT_TOKEN) };
}
