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
  handler?: (...args: any[]) => Promise<any> | any;
};

function createMockPi() {
  const tools: ToolDefinitionLike[] = [];
  const commands = new Map<string, CommandDefinitionLike>();
  const eventHandlers = new Map<string, Array<(...args: any[]) => any>>();
  const sentMessages: any[] = [];

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
    setLabel() {},
    async exec() {
      throw new Error('Mock pi.exec() not implemented for this test');
    },
    getActiveTools() {
      return tools.map((tool) => tool.name);
    },
    getAllTools() {
      return tools;
    },
    setActiveTools() {},
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
    sentMessages,
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
      for (const handler of handlers) {
        await handler(payload, ctx);
      }
    },
    countHandlers(event: string) {
      return (eventHandlers.get(event) ?? []).length;
    },
  };
}

function createMockContext(options?: { cwd?: string; hasUI?: boolean }) {
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses = new Map<string, string | undefined>();

  const cwd = options?.cwd ?? process.cwd();
  const hasUI = options?.hasUI ?? false;

  return {
    cwd,
    hasUI,
    notifications,
    statuses,
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
    modelRegistry: undefined,
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
  };
}

async function withTempHome<T>(fn: (homeDir: string) => Promise<T>): Promise<T> {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'pi-compat-home-'));
  process.env.HOME = homeDir;

  try {
    return await fn(homeDir);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
}

describe('Pi extension compatibility harness', () => {
  test('Context7 registers canonical tools and aliases', async () => {
    const pi = createMockPi();
    const { default: context7Extension } = await import('../packages/context7/extensions/context7/index.ts');

    context7Extension(pi.api as any);

    expect(pi.tools.map((tool) => tool.name)).toEqual([
      'context7_resolve_library_id',
      'context7_get_library_docs',
      'context7_get_cached_doc_raw',
      'resolve-library-id',
      'get-library-docs',
      'query-docs',
    ]);

    const getLibraryDocsAlias = pi.getTool('get-library-docs');
    const queryDocsAlias = pi.getTool('query-docs');

    expect(getLibraryDocsAlias.prepareArguments?.({
      context7CompatibleLibraryID: '/vercel/next.js',
      topic: 'routing',
      page: 2,
    })).toEqual({
      libraryId: '/vercel/next.js',
      query: 'routing',
      page: 2,
    });

    expect(queryDocsAlias.prepareArguments?.({
      libraryName: 'react',
      query: 'hooks',
      topic: 'useEffect',
      page: 3,
    })).toEqual({
      libraryName: 'react',
      query: 'hooks',
      topic: 'useEffect',
      page: 3,
    });
  });

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

      const configPath = path.join(
        homeDir,
        '.pi',
        'agent',
        'extensions',
        'lsp',
        'config.json',
      );
      const starterConfig = await readFile(configPath, 'utf8');
      expect(starterConfig).toContain('typescript-language-server');
      expect(ctx.statuses.has('lsp')).toBe(true);

      const tool = pi.getTool('lsp');
      await expect(tool.execute?.('tool-1', { operation: 'diagnostics' })).rejects.toThrow(
        "Operation 'diagnostics' requires filePath",
      );
    });
  });

  test('Questionnaire tool degrades safely when no UI is available', async () => {
    const pi = createMockPi();
    const { default: questionnaireExtension } = await import(
      '../packages/questionnaire/extensions/questionnaire/index.ts'
    );

    questionnaireExtension(pi.api as any);

    expect(pi.tools.map((tool) => tool.name)).toEqual(['questionnaire']);
    expect([...pi.commands.keys()]).toEqual(['questionnaire']);

    const ctx = createMockContext({ hasUI: false });
    const tool = pi.getTool('questionnaire');
    const result = await tool.execute?.(
      'tool-1',
      {
        questions: [
          {
            id: 'priority',
            prompt: 'How urgent is this?',
            options: [
              { value: 'p0', label: 'P0' },
              { value: 'p1', label: 'P1' },
            ],
          },
        ],
      },
      undefined,
      undefined,
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.details.cancelled).toBe(true);
    expect(result.content[0].text).toContain('UI not available');
  });

  test('Subagent extension registers commands and handles invalid invocations without crashing', async () => {
    await withTempHome(async () => {
      const pi = createMockPi();
      const { default: subagentExtension } = await import('../packages/subagent/extensions/subagent/index.ts');

      subagentExtension(pi.api as any);

      expect(pi.tools.map((tool) => tool.name)).toEqual(['subagent']);
      expect([...pi.commands.keys()].sort()).toEqual(['delegate', 'delegate-agents']);

      const ctx = createMockContext({ cwd: process.cwd(), hasUI: false });
      const tool = pi.getTool('subagent');
      const result = await tool.execute?.('tool-1', {}, undefined, undefined, ctx);

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('Invalid parameters.');
      expect(result.content[0].text).toContain('Available agents:');
      expect(result.content[0].text).toContain('planner');
    });
  });
});
