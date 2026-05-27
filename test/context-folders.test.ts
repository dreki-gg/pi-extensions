import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// --- Mock helpers (same pattern as pi-compat.test.ts) ---

type ToolDefinitionLike = {
  name: string;
  description?: string;
  execute?: (...args: any[]) => Promise<any> | any;
};

type CommandDefinitionLike = {
  description?: string;
  handler?: (...args: any[]) => Promise<any> | any;
};

function createMockPi() {
  const tools: ToolDefinitionLike[] = [];
  const commands = new Map<string, CommandDefinitionLike>();
  const eventHandlers = new Map<string, Array<(...args: any[]) => any>>();
  const sentMessages: Array<{ message: any; options?: any }> = [];

  const api = {
    on(event: string, handler: (...args: any[]) => any) {
      const handlers = eventHandlers.get(event) ?? [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
    },
    registerTool(tool: ToolDefinitionLike) {
      tools.push(tool);
    },
    registerCommand(name: string, definition: CommandDefinitionLike) {
      commands.set(name, definition);
    },
    registerShortcut() {},
    registerFlag() {},
    registerMessageRenderer() {},
    sendMessage(message: any, options?: any) {
      sentMessages.push({ message, options });
    },
    sendUserMessage() {},
    appendEntry() {},
    setSessionName() {},
    getSessionName() { return undefined; },
    getFlag() { return undefined; },
    setLabel() {},
    getActiveTools() { return []; },
    getAllTools() { return tools; },
    setActiveTools() {},
  };

  return {
    api,
    tools,
    commands,
    sentMessages,
    getCommand(name: string) {
      const cmd = commands.get(name);
      if (!cmd) throw new Error(`Command not registered: ${name}`);
      return cmd;
    },
    async emit(event: string, payload: any, ctx: any) {
      const handlers = eventHandlers.get(event) ?? [];
      const results: any[] = [];
      for (const handler of handlers) {
        results.push(await handler(payload, ctx));
      }
      return results;
    },
    countHandlers(event: string) {
      return (eventHandlers.get(event) ?? []).length;
    },
  };
}

function createMockContext(cwd: string) {
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses = new Map<string, string | undefined>();

  return {
    cwd,
    hasUI: false,
    notifications,
    statuses,
    ui: {
      notify(message: string, level = 'info') {
        notifications.push({ message, level });
      },
      setStatus(key: string, value: string | undefined) {
        statuses.set(key, value);
      },
      confirm: async () => false,
      select: async () => undefined,
      input: async () => undefined,
      theme: {
        fg: (_c: string, t: string) => t,
        bold: (t: string) => t,
      },
    },
  };
}

// --- Config module tests ---

describe('context-folders config', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ctx-folders-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('loadConfig returns empty folders when no config file exists', async () => {
    const { loadConfig } = await import(
      '../packages/context-folders/extensions/context-folders/config'
    );
    const config = loadConfig(tmpDir);
    expect(config).toEqual({ folders: [] });
  });

  test('loadConfig reads existing config', async () => {
    const { loadConfig } = await import(
      '../packages/context-folders/extensions/context-folders/config'
    );
    await mkdir(path.join(tmpDir, '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, '.pi/context-folders.json'),
      JSON.stringify({ folders: [{ path: '../sibling', label: 'Sibling' }] }),
    );

    const config = loadConfig(tmpDir);
    expect(config.folders).toHaveLength(1);
    expect(config.folders[0].label).toBe('Sibling');
  });

  test('loadConfig returns empty on malformed JSON', async () => {
    const { loadConfig } = await import(
      '../packages/context-folders/extensions/context-folders/config'
    );
    await mkdir(path.join(tmpDir, '.pi'), { recursive: true });
    await writeFile(path.join(tmpDir, '.pi/context-folders.json'), '{bad json');

    const config = loadConfig(tmpDir);
    expect(config).toEqual({ folders: [] });
  });

  test('saveConfig creates .pi directory and writes file', async () => {
    const { saveConfig } = await import(
      '../packages/context-folders/extensions/context-folders/config'
    );
    saveConfig(tmpDir, { folders: [{ path: '/abs/path', label: 'Test' }] });

    const content = JSON.parse(await readFile(path.join(tmpDir, '.pi/context-folders.json'), 'utf8'));
    expect(content.folders[0].label).toBe('Test');
  });

  test('resolveFolders resolves relative paths and checks existence', async () => {
    const { resolveFolders } = await import(
      '../packages/context-folders/extensions/context-folders/config'
    );
    // Create a real subfolder
    await mkdir(path.join(tmpDir, 'real-project'));

    const folders = resolveFolders(tmpDir, {
      folders: [
        { path: './real-project', label: 'Real' },
        { path: './missing-project' },
      ],
    });

    expect(folders).toHaveLength(2);
    expect(folders[0].exists).toBe(true);
    expect(folders[0].label).toBe('Real');
    expect(folders[0].path).toBe(path.join(tmpDir, 'real-project'));
    expect(folders[1].exists).toBe(false);
    expect(folders[1].label).toBe('missing-project'); // defaults to basename
  });
});

// --- Prompt builder tests ---

describe('context-folders prompt', () => {
  test('buildContextFoldersPrompt returns empty string when no valid folders', async () => {
    const { buildContextFoldersPrompt } = await import(
      '../packages/context-folders/extensions/context-folders/prompt'
    );
    expect(buildContextFoldersPrompt([])).toBe('');
    expect(
      buildContextFoldersPrompt([{ path: '/missing', label: 'Missing', exists: false }]),
    ).toBe('');
  });

  test('buildContextFoldersPrompt includes only existing folders', async () => {
    const { buildContextFoldersPrompt } = await import(
      '../packages/context-folders/extensions/context-folders/prompt'
    );
    const prompt = buildContextFoldersPrompt([
      { path: '/a', label: 'Project A', exists: true },
      { path: '/b', label: 'Project B', exists: false },
      { path: '/c', label: 'Project C', exists: true },
    ]);

    expect(prompt).toContain('Project A');
    expect(prompt).toContain('/a');
    expect(prompt).not.toContain('Project B');
    expect(prompt).toContain('Project C');
    expect(prompt).toContain('Extra Context Folders');
  });

  test('buildFolderListDisplay shows status indicators', async () => {
    const { buildFolderListDisplay } = await import(
      '../packages/context-folders/extensions/context-folders/prompt'
    );
    const display = buildFolderListDisplay([
      { path: '/exists', label: 'Good', exists: true },
      { path: '/missing', label: 'Bad', exists: false },
    ]);

    expect(display).toContain('✓ Good');
    expect(display).toContain('✗ Bad');
  });

  test('buildFolderListDisplay shows help when empty', async () => {
    const { buildFolderListDisplay } = await import(
      '../packages/context-folders/extensions/context-folders/prompt'
    );
    expect(buildFolderListDisplay([])).toContain('/context-folders add');
  });
});

// --- Extension integration tests ---

describe('context-folders extension', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ctx-folders-ext-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('registers expected event handlers and command', async () => {
    const pi = createMockPi();
    const { default: extension } = await import(
      '../packages/context-folders/extensions/context-folders/index'
    );

    extension(pi.api as any);

    expect(pi.countHandlers('session_start')).toBe(1);
    expect(pi.countHandlers('before_agent_start')).toBe(0);
    expect(pi.commands.has('context-folders')).toBe(true);
  });

  test('session_start loads config and sets status for valid folders', async () => {
    // Create a sibling folder and config
    const siblingDir = path.join(tmpDir, 'sibling');
    await mkdir(siblingDir);
    await mkdir(path.join(tmpDir, 'project', '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, 'project', '.pi/context-folders.json'),
      JSON.stringify({
        folders: [{ path: '../sibling', label: 'Sibling' }],
      }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(path.join(tmpDir, 'project'));
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    expect(ctx.statuses.get('ctx-folders')).toBe('📁 1 context folder');
  });

  test('session_start does not set status when no valid folders', async () => {
    await mkdir(path.join(tmpDir, '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, '.pi/context-folders.json'),
      JSON.stringify({ folders: [{ path: './nonexistent' }] }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t2=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(tmpDir);
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    expect(ctx.statuses.get('ctx-folders')).toBeUndefined();
  });

  test('session_start injects folder context via sendMessage', async () => {
    const siblingDir = path.join(tmpDir, 'sibling');
    await mkdir(siblingDir);
    await mkdir(path.join(tmpDir, 'project', '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, 'project', '.pi/context-folders.json'),
      JSON.stringify({ folders: [{ path: '../sibling', label: 'Sibling' }] }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t3=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(path.join(tmpDir, 'project'));
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    expect(pi.sentMessages).toHaveLength(1);
    expect(pi.sentMessages[0].message.content).toContain('Sibling');
    expect(pi.sentMessages[0].message.content).toContain(siblingDir);
    expect(pi.sentMessages[0].message.customType).toBe('context-folders-info');
    expect(pi.sentMessages[0].options).toEqual({ triggerTurn: false });
  });

  test('session_start does not inject context when no valid folders', async () => {
    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t4=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(tmpDir);
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    expect(pi.sentMessages).toHaveLength(0);
  });

  test('/context-folders list shows configured folders', async () => {
    const siblingDir = path.join(tmpDir, 'sibling');
    await mkdir(siblingDir);
    await mkdir(path.join(tmpDir, 'project', '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, 'project', '.pi/context-folders.json'),
      JSON.stringify({ folders: [{ path: '../sibling', label: 'Sibling' }] }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t5=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(path.join(tmpDir, 'project'));
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    await pi.getCommand('context-folders').handler?.('list', ctx);
    expect(ctx.notifications.at(-1)?.message).toContain('✓ Sibling');
  });

  test('/context-folders add creates a new folder entry and re-injects context', async () => {
    const newProject = path.join(tmpDir, 'new-project');
    await mkdir(newProject);
    await mkdir(path.join(tmpDir, 'project', '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, 'project', '.pi/context-folders.json'),
      JSON.stringify({ folders: [] }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t6=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(path.join(tmpDir, 'project'));
    await pi.emit('session_start', { reason: 'startup' }, ctx);
    expect(pi.sentMessages).toHaveLength(0); // no folders yet

    await pi.getCommand('context-folders').handler?.('add ../new-project My Project', ctx);
    expect(ctx.notifications.at(-1)?.message).toContain('My Project');

    // Verify it was persisted
    const saved = JSON.parse(await readFile(path.join(tmpDir, 'project', '.pi/context-folders.json'), 'utf8'));
    expect(saved.folders).toHaveLength(1);
    expect(saved.folders[0].path).toBe('../new-project');
    expect(saved.folders[0].label).toBe('My Project');

    // Verify context was re-injected after add
    expect(pi.sentMessages).toHaveLength(1);
    expect(pi.sentMessages[0].message.content).toContain('My Project');

    // Verify status was updated
    expect(ctx.statuses.get('ctx-folders')).toBe('📁 1 context folder');
  });

  test('/context-folders add without path shows error', async () => {
    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t7=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(tmpDir);
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    await pi.getCommand('context-folders').handler?.('add', ctx);
    expect(ctx.notifications.at(-1)?.level).toBe('error');
    expect(ctx.notifications.at(-1)?.message).toContain('Usage');
  });

  test('/context-folders remove deletes a folder entry', async () => {
    await mkdir(path.join(tmpDir, '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, '.pi/context-folders.json'),
      JSON.stringify({ folders: [{ path: '../sibling', label: 'Sibling' }] }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t8=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(tmpDir);
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    await pi.getCommand('context-folders').handler?.('remove Sibling', ctx);
    expect(ctx.notifications.at(-1)?.message).toContain('Removed');

    const saved = JSON.parse(await readFile(path.join(tmpDir, '.pi/context-folders.json'), 'utf8'));
    expect(saved.folders).toHaveLength(0);

    // Verify status was cleared
    expect(ctx.statuses.get('ctx-folders')).toBeUndefined();
  });

  test('/context-folders remove with unknown folder shows error', async () => {
    await mkdir(path.join(tmpDir, '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, '.pi/context-folders.json'),
      JSON.stringify({ folders: [] }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t9=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(tmpDir);
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    await pi.getCommand('context-folders').handler?.('remove nonexistent', ctx);
    expect(ctx.notifications.at(-1)?.level).toBe('error');
  });

  test('/context-folders init creates config file', async () => {
    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t10=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(tmpDir);
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    await pi.getCommand('context-folders').handler?.('init', ctx);
    expect(existsSync(path.join(tmpDir, '.pi/context-folders.json'))).toBe(true);
    expect(ctx.notifications.at(-1)?.message).toContain('Created');
  });

  test('/context-folders init does not overwrite existing config', async () => {
    await mkdir(path.join(tmpDir, '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, '.pi/context-folders.json'),
      JSON.stringify({ folders: [{ path: '../keep-me' }] }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t11=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(tmpDir);
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    await pi.getCommand('context-folders').handler?.('init', ctx);
    expect(ctx.notifications.at(-1)?.message).toContain('already exists');

    // Verify original content preserved
    const saved = JSON.parse(await readFile(path.join(tmpDir, '.pi/context-folders.json'), 'utf8'));
    expect(saved.folders[0].path).toBe('../keep-me');
  });

  test('status shows plural for multiple folders', async () => {
    const dir1 = path.join(tmpDir, 'a');
    const dir2 = path.join(tmpDir, 'b');
    await mkdir(dir1);
    await mkdir(dir2);
    await mkdir(path.join(tmpDir, 'project', '.pi'), { recursive: true });
    await writeFile(
      path.join(tmpDir, 'project', '.pi/context-folders.json'),
      JSON.stringify({
        folders: [
          { path: '../a', label: 'A' },
          { path: '../b', label: 'B' },
        ],
      }),
    );

    const pi = createMockPi();
    const { default: extension } = await import(
      `../packages/context-folders/extensions/context-folders/index?t12=${Date.now()}`
    );
    extension(pi.api as any);

    const ctx = createMockContext(path.join(tmpDir, 'project'));
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    expect(ctx.statuses.get('ctx-folders')).toBe('📁 2 context folders');
  });
});
