import { test, expect } from 'bun:test';
import slackExtension from '../extensions/slack/index.js';

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
  slackExtension(mockPi as any);
  return { tools, commands, events };
}

test('registers all eight tools, command, and session_start handler', () => {
  const { tools, commands, events } = loadExtension();

  expect(tools.map((t) => t.name).sort()).toEqual([
    'slack_delete_message',
    'slack_download_file',
    'slack_edit_message',
    'slack_list_channels',
    'slack_post_message',
    'slack_read_messages',
    'slack_read_thread',
    'slack_search',
  ]);

  for (const t of tools) {
    expect(typeof t.execute).toBe('function');
    expect(t.parameters).toBeDefined();
    expect(Array.isArray(t.promptGuidelines)).toBe(true);
    expect(typeof t.promptSnippet).toBe('string');
  }

  expect(commands.has('slack')).toBe(true);
  expect(events.has('session_start')).toBe(true);
});

test('tools error gracefully when SLACK_BOT_TOKEN is missing', async () => {
  const orig = process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_BOT_TOKEN;

  try {
    const { tools } = loadExtension();
    const listChannels = tools.find((t) => t.name === 'slack_list_channels')!;
    const result = await listChannels.execute('id', {}, undefined, undefined, {
      cwd: process.cwd(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('SLACK_BOT_TOKEN');
  } finally {
    if (orig) process.env.SLACK_BOT_TOKEN = orig;
  }
});

test('post message tool errors gracefully when SLACK_BOT_TOKEN is missing', async () => {
  const orig = process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_BOT_TOKEN;

  try {
    const { tools } = loadExtension();
    const post = tools.find((t) => t.name === 'slack_post_message')!;
    const result = await post.execute('id', { channel: 'C123', text: 'hi' }, undefined, undefined, {
      cwd: process.cwd(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('SLACK_BOT_TOKEN');
  } finally {
    if (orig) process.env.SLACK_BOT_TOKEN = orig;
  }
});

test('edit message tool errors gracefully when SLACK_BOT_TOKEN is missing', async () => {
  const orig = process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_BOT_TOKEN;

  try {
    const { tools } = loadExtension();
    const edit = tools.find((t) => t.name === 'slack_edit_message')!;
    const result = await edit.execute(
      'id',
      { channel: 'C123', ts: '1700000000.000100', text: 'updated' },
      undefined,
      undefined,
      { cwd: process.cwd() },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('SLACK_BOT_TOKEN');
  } finally {
    if (orig) process.env.SLACK_BOT_TOKEN = orig;
  }
});

test('delete message tool errors gracefully when SLACK_BOT_TOKEN is missing', async () => {
  const orig = process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_BOT_TOKEN;

  try {
    const { tools } = loadExtension();
    const del = tools.find((t) => t.name === 'slack_delete_message')!;
    const result = await del.execute(
      'id',
      { channel: 'C123', ts: '1700000000.000100' },
      undefined,
      undefined,
      { cwd: process.cwd() },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('SLACK_BOT_TOKEN');
  } finally {
    if (orig) process.env.SLACK_BOT_TOKEN = orig;
  }
});

test('search tool requires SLACK_USER_TOKEN', async () => {
  const orig = process.env.SLACK_BOT_TOKEN;
  const origUser = process.env.SLACK_USER_TOKEN;
  process.env.SLACK_BOT_TOKEN = 'xoxb-fake';
  delete process.env.SLACK_USER_TOKEN;

  try {
    const { tools } = loadExtension();
    const search = tools.find((t) => t.name === 'slack_search')!;
    const result = await search.execute('id', { query: 'test' }, undefined, undefined, {
      cwd: process.cwd(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('SLACK_USER_TOKEN');
  } finally {
    if (orig) process.env.SLACK_BOT_TOKEN = orig;
    else delete process.env.SLACK_BOT_TOKEN;
    if (origUser) process.env.SLACK_USER_TOKEN = origUser;
  }
});
