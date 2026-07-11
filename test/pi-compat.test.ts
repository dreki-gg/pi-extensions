import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type ToolDefinitionLike = {
  name: string;
  description?: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters?: unknown;
  prepareArguments?: (args: unknown) => unknown;
  execute?: (...args: any[]) => Promise<any> | any;
};

type CommandDefinitionLike = {
  description?: string;
  getArgumentCompletions?: (argumentPrefix: string) => Promise<any[] | null> | any[] | null;
  handler?: (...args: any[]) => Promise<any> | any;
};

function createMockPi() {
  const tools: ToolDefinitionLike[] = [];
  const activeTools: string[] = [];
  const commands = new Map<string, CommandDefinitionLike>();
  const messageRenderers = new Map<string, (...args: any[]) => any>();
  const eventHandlers = new Map<string, Array<(...args: any[]) => any>>();
  const sentMessages: any[] = [];
  const flags = new Map<string, unknown>();

  const api = {
    on(event: string, handler: (...args: any[]) => any) {
      const handlers = eventHandlers.get(event) ?? [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
    },
    registerTool(tool: ToolDefinitionLike) {
      tools.push(tool);
      if (!activeTools.includes(tool.name)) activeTools.push(tool.name);
    },
    registerCommand(name: string, definition: CommandDefinitionLike) {
      commands.set(name, definition);
    },
    registerShortcut() {},
    registerFlag() {},
    registerMessageRenderer(customType: string, renderer: (...args: any[]) => any) {
      messageRenderers.set(customType, renderer);
    },
    getCommands() {
      return [...commands.entries()].map(([name, definition]) => ({
        name,
        description: definition.description,
        source: 'extension',
        sourceInfo: {
          path: `<mock:${name}>`,
          source: 'extension',
          scope: 'temporary',
          origin: 'top-level',
        },
      }));
    },
    sendMessage(message: any) {
      sentMessages.push(message);
    },
    sendUserMessage(message: any) {
      sentMessages.push({ type: 'user', message });
    },
    appendEntry() {},
    setSessionName() {},
    getSessionName() {
      return undefined;
    },
    getFlag(name: string) {
      const normalized = name.startsWith('--') ? name.slice(2) : name;
      return flags.get(normalized);
    },
    setLabel() {},
    async exec() {
      throw new Error('Mock pi.exec() not implemented for this test');
    },
    getActiveTools() {
      return [...activeTools];
    },
    getAllTools() {
      return tools;
    },
    setActiveTools(names: string[]) {
      activeTools.splice(0, activeTools.length, ...names);
    },
    async setModel() {
      return true;
    },
    getThinkingLevel() {
      return 'medium';
    },
    setThinkingLevel() {},
    events: {
      on() {},
      emit() {},
    },
    registerProvider() {},
    unregisterProvider() {},
  };

  return {
    api,
    tools,
    commands,
    messageRenderers,
    sentMessages,
    setFlag(name: string, value: unknown) {
      flags.set(name, value);
    },
    getTool(name: string) {
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      return tool;
    },
    getCommand(name: string) {
      const command = commands.get(name);
      if (!command) throw new Error(`Command not registered: ${name}`);
      return command;
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

function createMockContext(options?: { cwd?: string; hasUI?: boolean }) {
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses = new Map<string, string | undefined>();
  const forkCalls: Array<{ entryId: string; options?: Record<string, unknown> }> = [];

  const cwd = options?.cwd ?? process.cwd();
  const hasUI = options?.hasUI ?? false;

  return {
    cwd,
    hasUI,
    notifications,
    statuses,
    forkCalls,
    ui: {
      notify(message: string, level = 'info') {
        notifications.push({ message, level });
      },
      setStatus(key: string, value: string | undefined) {
        statuses.set(key, value);
      },
      async confirm() {
        return false;
      },
      async select() {
        return undefined;
      },
      async input() {
        return undefined;
      },
      async editor() {
        return undefined;
      },
      async custom() {
        return undefined;
      },
      setWidget() {},
      setFooter() {},
      setTitle() {},
      setEditorText() {},
      getEditorText() {
        return '';
      },
      pasteToEditor() {},
      getToolsExpanded() {
        return false;
      },
      setToolsExpanded() {},
      setEditorComponent() {},
      addAutocompleteProvider() {
        return () => {};
      },
      getAllThemes() {
        return [];
      },
      getTheme() {
        return undefined;
      },
      setTheme() {
        return { success: true };
      },
      theme: {
        fg(_color: string, text: string) {
          return text;
        },
        bold(text: string) {
          return text;
        },
        italic(text: string) {
          return text;
        },
        strikethrough(text: string) {
          return text;
        },
      },
    },
    sessionManager: {
      getEntries() {
        return [];
      },
      getBranch() {
        return [];
      },
      getLeafId() {
        return 'leaf';
      },
      getSessionFile() {
        return undefined;
      },
      getLabel() {
        return undefined;
      },
    },
    modelRegistry: {
      find(_provider: string, _id: string) {
        return null;
      },
    },
    model: undefined,
    signal: undefined,
    isIdle() {
      return true;
    },
    abort() {},
    hasPendingMessages() {
      return false;
    },
    shutdown() {},
    getContextUsage() {
      return undefined;
    },
    compact() {},
    getSystemPrompt() {
      return '';
    },
    async waitForIdle() {},
    async fork(entryId: string, options?: Record<string, unknown>) {
      forkCalls.push({ entryId, options });
      return { cancelled: false };
    },
    async newSession() {
      return { cancelled: false };
    },
    async switchSession() {
      return { cancelled: false };
    },
    async reload() {},
  };
}

async function withTempHome<T>(fn: (homeDir: string) => Promise<T>): Promise<T> {
  const previousHome = process.env.HOME;
  const previousPiDir = process.env.PI_CODING_AGENT_DIR;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'pi-compat-home-'));
  process.env.HOME = homeDir;
  process.env.PI_CODING_AGENT_DIR = path.join(homeDir, '.pi', 'agent');

  try {
    return await fn(homeDir);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousPiDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousPiDir;
    await rm(homeDir, { recursive: true, force: true });
  }
}

describe('Pi extension compatibility harness', () => {
  test('LSP extension boots, scaffolds config, and keeps validation behavior intact', async () => {
    await withTempHome(async (homeDir) => {
      const pi = createMockPi();
      const { default: lspExtension } = await import('../packages/lsp/extensions/lsp/index.ts');

      lspExtension(pi.api as any);

      expect(pi.tools.map((tool) => tool.name)).toEqual(['lsp']);
      expect([...pi.commands.keys()].sort()).toEqual(['lsp', 'lsp-restart']);
      expect(pi.countHandlers('session_start')).toBeGreaterThan(0);
      expect(pi.countHandlers('session_shutdown')).toBeGreaterThan(0);
      expect(pi.countHandlers('tool_execution_end')).toBeGreaterThan(0);

      const ctx = createMockContext({
        cwd: path.join(process.cwd(), 'packages/lsp'),
        hasUI: true,
      });

      await pi.emit('session_start', { reason: 'startup' }, ctx);

      const configPath = path.join(homeDir, '.pi', 'agent', 'extensions', 'lsp', 'config.json');
      const starterConfig = await readFile(configPath, 'utf8');
      expect(starterConfig).toContain('typescript-language-server');
      expect(ctx.statuses.has('lsp')).toBe(true);

      const tool = pi.getTool('lsp');
      await expect(tool.execute?.('tool-1', { operation: 'diagnostics' })).rejects.toThrow(
        "Operation 'diagnostics' requires filePath",
      );
    });
  });
});
