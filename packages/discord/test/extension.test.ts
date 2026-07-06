import { test, expect } from 'bun:test';
import discordExtension from '../extensions/discord/index.js';

interface MockTool {
  name: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters?: unknown;
  execute: (...args: unknown[]) => Promise<{ isError?: boolean; content: Array<{ text: string }> }>;
}

function loadExtension() {
  const tools: MockTool[] = [];
  const commands = new Map<string, unknown>();
  const events = new Map<string, unknown[]>();

  const mockPi = {
    on(ev: string, h: unknown) {
      const arr = events.get(ev) ?? [];
      arr.push(h);
      events.set(ev, arr);
    },
    registerTool(t: MockTool) {
      tools.push(t);
    },
    registerCommand(name: string, opts: unknown) {
      commands.set(name, opts);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discordExtension(mockPi as any);
  return { tools, commands, events };
}

test('registers all three tools, command, and session_start handler', () => {
  const { tools, commands, events } = loadExtension();

  expect(tools.map((t) => t.name).sort()).toEqual([
    'discord_download_attachment',
    'discord_list_channels',
    'discord_read_messages',
  ]);

  for (const t of tools) {
    expect(typeof t.execute).toBe('function');
    expect(t.parameters).toBeDefined();
    expect(Array.isArray(t.promptGuidelines)).toBe(true);
    expect(typeof t.promptSnippet).toBe('string');
  }

  expect(commands.has('discord')).toBe(true);
  expect(events.has('session_start')).toBe(true);
});

test('tools error gracefully when DISCORD_BOT_TOKEN is missing', async () => {
  const orig = process.env.DISCORD_BOT_TOKEN;
  delete process.env.DISCORD_BOT_TOKEN;

  try {
    const { tools } = loadExtension();
    const readMessages = tools.find((t) => t.name === 'discord_read_messages')!;
    const result = await readMessages.execute('id', { channel: '123' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('DISCORD_BOT_TOKEN');
  } finally {
    if (orig) process.env.DISCORD_BOT_TOKEN = orig;
  }
});

test('list_channels errors when no guild is available', async () => {
  const orig = process.env.DISCORD_BOT_TOKEN;
  process.env.DISCORD_BOT_TOKEN = 'bot-test';

  try {
    const { tools } = loadExtension();
    const listChannels = tools.find((t) => t.name === 'discord_list_channels')!;
    const result = await listChannels.execute('id', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('guild');
  } finally {
    if (orig) process.env.DISCORD_BOT_TOKEN = orig;
    else delete process.env.DISCORD_BOT_TOKEN;
  }
});
