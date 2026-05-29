import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  loadProjectConfig,
  getCredentials,
  getCredentialStatus,
} from '../extensions/slack/config.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'pi-slack-test-config');

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.pi'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('loadProjectConfig', () => {
  test('returns defaults when no config file exists', async () => {
    const emptyDir = join(tmpdir(), 'pi-slack-test-no-config');
    await mkdir(emptyDir, { recursive: true });

    const config = await loadProjectConfig(emptyDir);
    expect(config.messageLimit).toBe(50);
    expect(config.defaultChannel).toBeUndefined();

    await rm(emptyDir, { recursive: true, force: true });
  });

  test('parses valid config file', async () => {
    await writeFile(
      join(TEST_DIR, '.pi', 'slack.json'),
      JSON.stringify({ defaultChannel: 'C123', messageLimit: 25 }),
    );

    const config = await loadProjectConfig(TEST_DIR);
    expect(config.defaultChannel).toBe('C123');
    expect(config.messageLimit).toBe(25);
  });

  test('throws on invalid JSON', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'slack.json'), 'not json');
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('Invalid JSON');
  });

  test('throws on invalid messageLimit', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'slack.json'), JSON.stringify({ messageLimit: 'abc' }));
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('messageLimit');
  });

  test('throws on messageLimit out of range', async () => {
    await writeFile(join(TEST_DIR, '.pi', 'slack.json'), JSON.stringify({ messageLimit: 0 }));
    await expect(loadProjectConfig(TEST_DIR)).rejects.toThrow('messageLimit');
  });
});

describe('getCredentials', () => {
  const origBot = process.env.SLACK_BOT_TOKEN;
  const origUser = process.env.SLACK_USER_TOKEN;

  afterEach(() => {
    if (origBot) process.env.SLACK_BOT_TOKEN = origBot;
    else delete process.env.SLACK_BOT_TOKEN;
    if (origUser) process.env.SLACK_USER_TOKEN = origUser;
    else delete process.env.SLACK_USER_TOKEN;
  });

  test('returns null when bot token is missing', () => {
    delete process.env.SLACK_BOT_TOKEN;
    expect(getCredentials()).toBeNull();
  });

  test('returns credentials with bot token', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    delete process.env.SLACK_USER_TOKEN;

    const creds = getCredentials();
    expect(creds).not.toBeNull();
    expect(creds!.botToken).toBe('xoxb-test');
    expect(creds!.userToken).toBeUndefined();
  });

  test('includes user token when set', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_USER_TOKEN = 'xoxp-test';

    const creds = getCredentials();
    expect(creds!.userToken).toBe('xoxp-test');
  });
});

describe('getCredentialStatus', () => {
  test('reports token presence', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    delete process.env.SLACK_USER_TOKEN;

    const status = getCredentialStatus();
    expect(status.hasBotToken).toBe(true);
    expect(status.hasUserToken).toBe(false);
  });
});
