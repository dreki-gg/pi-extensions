import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  loadProjectConfig,
  getCredentials,
  getCredentialStatus,
} from '../extensions/discord/config.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'pi-discord-test-config');

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.pi'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('loadProjectConfig', () => {
  test('returns defaults when no config file exists', async () => {
    const emptyDir = join(tmpdir(), 'pi-discord-test-no-config');
    await mkdir(emptyDir, { recursive: true });

    const config = await loadProjectConfig(emptyDir);
    expect(config.messageLimit).toBe(50);
    expect(config.defaultGuild).toBeUndefined();
    expect(config.defaultChannel).toBeUndefined();

    await rm(emptyDir, { recursive: true, force: true });
  });

  test('parses valid config file', async () => {
    await writeFile(
      join(TEST_DIR, '.pi', 'discord.json'),
      JSON.stringify({ defaultGuild: '111', defaultChannel: '222', messageLimit: 25 }),
    );

    const config = await loadProjectConfig(TEST_DIR);
    expect(config.defaultGuild).toBe('111');
    expect(config.defaultChannel).toBe('222');
    expect(config.messageLimit).toBe(25);
  });

  test('throws on invalid JSON', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'discord.json'), 'not json');
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('Invalid JSON');
  });

  test('throws on invalid messageLimit', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'discord.json'), JSON.stringify({ messageLimit: 'abc' }));
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('messageLimit');
  });

  test('throws on messageLimit out of range', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'discord.json'), JSON.stringify({ messageLimit: 500 }));
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('messageLimit');
  });
});

describe('getCredentials', () => {
  const origBot = process.env.DISCORD_BOT_TOKEN;

  afterEach(() => {
    if (origBot) process.env.DISCORD_BOT_TOKEN = origBot;
    else delete process.env.DISCORD_BOT_TOKEN;
  });

  test('returns null when bot token is missing', () => {
    delete process.env.DISCORD_BOT_TOKEN;
    expect(getCredentials()).toBeNull();
  });

  test('returns credentials with bot token', () => {
    process.env.DISCORD_BOT_TOKEN = 'bot-test';
    const creds = getCredentials();
    expect(creds).not.toBeNull();
    expect(creds!.botToken).toBe('bot-test');
  });
});

describe('getCredentialStatus', () => {
  test('reports token presence', () => {
    process.env.DISCORD_BOT_TOKEN = 'bot-test';
    const status = getCredentialStatus();
    expect(status.hasBotToken).toBe(true);
  });
});
