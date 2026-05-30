import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionManager, type SessionInfo } from '@earendil-works/pi-coding-agent';

function sessionInfo(partial: Partial<SessionInfo> & { path: string }): SessionInfo {
  const now = new Date('2026-05-29T10:00:00.000Z');
  return {
    id: partial.id ?? partial.path,
    path: partial.path,
    cwd: partial.cwd ?? '/repo/current',
    name: partial.name,
    parentSessionPath: partial.parentSessionPath,
    created: partial.created ?? now,
    modified: partial.modified ?? now,
    messageCount: partial.messageCount ?? 2,
    firstMessage: partial.firstMessage ?? 'First prompt',
    allMessagesText: partial.allMessagesText ?? partial.firstMessage ?? 'First prompt',
  };
}

function createMockPi() {
  const commands = new Map<string, any>();
  const handlers = new Map<string, Array<(...args: any[]) => any>>();
  return {
    api: {
      on(event: string, handler: (...args: any[]) => any) {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      },
      registerCommand(name: string, definition: any) {
        commands.set(name, definition);
      },
      registerTool() {},
      registerShortcut() {},
      registerFlag() {},
      registerMessageRenderer() {},
      sendMessage() {},
      sendUserMessage() {},
      appendEntry() {},
      setSessionName() {},
      getSessionName() { return undefined; },
      getFlag() { return undefined; },
      setLabel() {},
      getActiveTools() { return []; },
      getAllTools() { return []; },
      setActiveTools() {},
    },
    commands,
    handlers,
    getCommand(name: string) {
      const command = commands.get(name);
      if (!command) throw new Error(`missing command ${name}`);
      return command;
    },
    async emit(event: string, payload: any, ctx: any) {
      const results = [];
      for (const handler of handlers.get(event) ?? []) results.push(await handler(payload, ctx));
      return results;
    },
    countHandlers(event: string) {
      return (handlers.get(event) ?? []).length;
    },
  };
}

function createMockContext(cwd: string) {
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses = new Map<string, string | undefined>();
  let autocompleteFactory: any;
  let editorText = '';
  return {
    cwd,
    hasUI: true,
    notifications,
    statuses,
    ui: {
      notify(message: string, level = 'info') { notifications.push({ message, level }); },
      setStatus(key: string, value: string | undefined) { statuses.set(key, value); },
      addAutocompleteProvider(factory: any) { autocompleteFactory = factory; },
      getAutocompleteFactory() { return autocompleteFactory; },
      async editor(_title: string, text: string) { return text; },
      setEditorText(text: string) { editorText = text; },
      getEditorText() { return editorText; },
    },
    modelRegistry: {
      find() { return null; },
      async getApiKeyAndHeaders() { return { ok: false, error: 'no key' }; },
    },
    signal: undefined,
  };
}

const originalList = SessionManager.list;

describe('past-chats config', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'past-chats-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('loads empty config when missing and saves normalized folders', async () => {
    const { loadConfig, saveConfig, resolveFolders } = await import('../packages/past-chats/extensions/past-chats/config');
    expect(loadConfig(tmpDir)).toEqual({ folders: [] });

    await mkdir(path.join(tmpDir, 'external'));
    saveConfig(tmpDir, { folders: [{ path: './external', label: 'External' }], summary: { ai: true, provider: 'openai', model: 'mini' } });

    const raw = JSON.parse(await readFile(path.join(tmpDir, '.pi/past-chats.json'), 'utf8'));
    expect(raw.folders[0].label).toBe('External');
    expect(loadConfig(tmpDir).summary?.ai).toBe(true);

    const folders = resolveFolders(tmpDir, loadConfig(tmpDir));
    expect(folders[0]).toMatchObject({ label: 'External', exists: true, path: path.join(tmpDir, 'external') });
  });
});

describe('past-chats tokens and index', () => {
  afterEach(() => {
    SessionManager.list = originalList;
  });

  test('extracts submitted references and active autocomplete tokens', async () => {
    const { extractReferenceTokens, findActiveToken, hashSessionPath } = await import('../packages/past-chats/extensions/past-chats/tokens');

    expect(findActiveToken('compare @chat:auth')?.query).toBe('auth');
    expect(extractReferenceTokens('read @session:abc123, then @chat:def456')).toEqual(['@session:abc123', '@chat:def456']);
    expect(hashSessionPath('/tmp/session.jsonl')).toHaveLength(12);
    expect(hashSessionPath('/tmp/session.jsonl')).toBe(hashSessionPath('/tmp/session.jsonl'));
  });

  test('indexes current and external sessions with current sessions first', async () => {
    const calls: string[] = [];
    SessionManager.list = (async (cwd: string) => {
      calls.push(cwd);
      return [sessionInfo({ path: `${cwd}/session.jsonl`, cwd, name: cwd.includes('external') ? 'External chat' : 'Current chat' })];
    }) as any;

    const { createPastChatIndex } = await import('../packages/past-chats/extensions/past-chats/indexer');
    const index = createPastChatIndex();
    await index.refresh('/repo/current', [{ path: '/repo/external', label: 'External', exists: true }]);

    expect(calls).toEqual(['/repo/current', '/repo/external']);
    const items = index.getItems();
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Current chat');
    expect(items[0].source.current).toBe(true);
    expect(index.resolveToken(items[1].token)?.title).toBe('External chat');
  });
});

describe('past-chats autocomplete and context', () => {
  afterEach(() => {
    SessionManager.list = originalList;
  });

  test('autocompletes @chat tokens and delegates otherwise', async () => {
    const { createPastChatsAutocompleteProvider } = await import('../packages/past-chats/extensions/past-chats/autocomplete');
    const { createPastChatIndex } = await import('../packages/past-chats/extensions/past-chats/indexer');
    const index = createPastChatIndex();
    SessionManager.list = (async () => [sessionInfo({ path: '/repo/current/a.jsonl', name: 'Auth refactor session', firstMessage: 'work on auth flow' })]) as any;
    await index.refresh('/repo/current', []);

    let delegated = false;
    const provider = createPastChatsAutocompleteProvider(
      {
        async getSuggestions() { delegated = true; return { prefix: '', items: [] }; },
        applyCompletion(_lines, _line, _col, item) { return { lines: [item.value], cursorLine: 0, cursorCol: item.value.length }; },
      } as any,
      { cwd: '/repo/current', config: { folders: [] }, folders: [], index },
    );

    const suggestions = await provider.getSuggestions(['please inspect @chat:auth'], 0, 25, { signal: new AbortController().signal } as any);
    expect(suggestions?.items[0].label).toBe('Auth refactor session');
    expect(suggestions?.items[0].value.startsWith('@chat:')).toBe(true);

    await provider.getSuggestions(['normal text'], 0, 11, { signal: new AbortController().signal } as any);
    expect(delegated).toBe(true);
  });

  test('injects hidden context for resolved session tokens', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'past-chats-session-'));
    try {
      const sessionPath = path.join(tmpDir, 'session.jsonl');
      await writeFile(
        sessionPath,
        [
          JSON.stringify({ type: 'session', version: 3, id: 's1', timestamp: '2026-05-29T10:00:00.000Z', cwd: tmpDir }),
          JSON.stringify({ type: 'message', id: 'u1', parentId: null, timestamp: '2026-05-29T10:01:00.000Z', message: { role: 'user', content: 'Fix auth bug', timestamp: Date.now() } }),
          JSON.stringify({ type: 'message', id: 'a1', parentId: 'u1', timestamp: '2026-05-29T10:02:00.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Changed login flow' }], timestamp: Date.now() } }),
        ].join('\n') + '\n',
      );

      SessionManager.list = (async () => [sessionInfo({ path: sessionPath, cwd: tmpDir, name: 'Auth bug chat', firstMessage: 'Fix auth bug' })]) as any;
      const pi = createMockPi();
      const ctx = createMockContext(tmpDir);
      const { default: extension } = await import('../packages/past-chats/extensions/past-chats/index');
      extension(pi.api as any);
      await pi.emit('session_start', {}, ctx);
      const token = (ctx as any).statuses.get('past-chats') ? '@session:' + (await import('../packages/past-chats/extensions/past-chats/tokens')).hashSessionPath(sessionPath) : '';

      const [result] = await pi.emit('before_agent_start', { prompt: `use ${token}` }, ctx);
      expect(result.message.display).toBe(false);
      expect(result.message.content).toContain('Auth bug chat');
      expect(result.message.content).toContain(sessionPath);
      expect(result.message.content).toContain('Fix auth bug');
      expect(ctx.notifications.some((n) => n.message.includes('Attached 1 past chat'))).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('warns loudly for unresolved tokens', async () => {
    const pi = createMockPi();
    const ctx = createMockContext('/repo/current');
    SessionManager.list = (async () => []) as any;
    const { default: extension } = await import('../packages/past-chats/extensions/past-chats/index');
    extension(pi.api as any);
    await pi.emit('session_start', {}, ctx);

    const [result] = await pi.emit('before_agent_start', { prompt: 'use @chat:missing' }, ctx);
    expect(result.message.display).toBe(true);
    expect(result.message.content).toContain('none could be resolved');
    expect(ctx.notifications.some((n) => n.level === 'warning')).toBe(true);
  });
});

describe('past-chats command and registration', () => {
  afterEach(() => {
    SessionManager.list = originalList;
  });

  test('registers handlers and command, then add/remove persists config', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'past-chats-cmd-'));
    try {
      SessionManager.list = (async () => []) as any;
      const pi = createMockPi();
      const ctx = createMockContext(tmpDir);
      const { default: extension } = await import('../packages/past-chats/extensions/past-chats/index');
      extension(pi.api as any);

      expect(pi.countHandlers('session_start')).toBe(1);
      expect(pi.countHandlers('before_agent_start')).toBe(1);
      expect(pi.commands.has('past-chats')).toBe(true);

      await pi.emit('session_start', {}, ctx);
      await pi.getCommand('past-chats').handler('add ../other Other Project', ctx);
      let saved = JSON.parse(await readFile(path.join(tmpDir, '.pi/past-chats.json'), 'utf8'));
      expect(saved.folders[0]).toEqual({ path: '../other', label: 'Other Project' });

      await pi.getCommand('past-chats').handler('remove Other Project', ctx);
      saved = JSON.parse(await readFile(path.join(tmpDir, '.pi/past-chats.json'), 'utf8'));
      expect(saved.folders).toEqual([]);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
