import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

async function withTempModesGlobalPath<T>(
  homeDir: string,
  fn: (presetsPath: string) => Promise<T>,
): Promise<T> {
  const previousPath = process.env.PI_MODES_GLOBAL_PRESETS_PATH;
  const presetsPath = path.join(homeDir, '.pi', 'agent', 'presets.json');
  process.env.PI_MODES_GLOBAL_PRESETS_PATH = presetsPath;

  try {
    return await fn(presetsPath);
  } finally {
    if (previousPath === undefined) delete process.env.PI_MODES_GLOBAL_PRESETS_PATH;
    else process.env.PI_MODES_GLOBAL_PRESETS_PATH = previousPath;
  }
}

describe('Pi extension compatibility harness', () => {
  test('Context7 registers canonical tools', async () => {
    const pi = createMockPi();
    const { default: context7Extension } =
      await import('../packages/context7/extensions/context7/index.ts');

    context7Extension(pi.api as any);

    expect(pi.tools.map((tool) => tool.name)).toEqual([
      'context7_resolve_library_id',
      'context7_get_library_docs',
      'context7_get_cached_doc_raw',
    ]);
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

  test('Questionnaire tool degrades safely when no UI is available', async () => {
    const pi = createMockPi();
    const { default: questionnaireExtension } =
      await import('../packages/questionnaire/extensions/questionnaire/index.ts');

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
      const { default: subagentExtension } =
        await import('../packages/subagent/extensions/subagent/index.ts');

      subagentExtension(pi.api as any);

      expect(pi.tools.map((tool) => tool.name)).toEqual(['subagent']);
      expect([...pi.commands.keys()].sort()).toEqual(['delegate-agents', 'run-agent']);
      expect(pi.messageRenderers.has('run-agent-summary')).toBe(true);

      const ctx = createMockContext({ cwd: process.cwd(), hasUI: false });
      const tool = pi.getTool('subagent');
      const result = await tool.execute?.('tool-1', {}, undefined, undefined, ctx);

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain('Invalid parameters.');
      expect(result.content[0].text).toContain('Available agents:');
      expect(result.content[0].text).toContain('planner');

      const runAgentCompletions = await pi
        .getCommand('run-agent')
        .getArgumentCompletions?.('--scope both wor');
      expect(runAgentCompletions?.some((item) => item.value === '--scope both worker')).toBe(true);

      const delegateAgentCompletions = await pi
        .getCommand('delegate-agents')
        .getArgumentCompletions?.('reset ');
      expect(delegateAgentCompletions?.some((item) => item.value === 'reset --all')).toBe(true);

      await pi.getCommand('run-agent').handler?.('', ctx);
      expect(ctx.notifications.at(-1)?.message).toContain('Usage: /run-agent');

      await pi.getCommand('run-agent').handler?.('worker fix the failing tests', ctx);
      expect(ctx.forkCalls).toHaveLength(1);
      expect(ctx.forkCalls[0]?.entryId).toBe('leaf');
      expect(ctx.forkCalls[0]?.options?.position).toBe('at');
      expect(typeof ctx.forkCalls[0]?.options?.withSession).toBe('function');

      const { bundledAgentsDir } =
        await import('../packages/subagent/extensions/subagent/agents.ts');
      const workerAgentPath = path.join(bundledAgentsDir, 'worker.md');
      const reviewerAgentPath = path.join(bundledAgentsDir, 'reviewer.md');
      const workerAgent = await readFile(workerAgentPath, 'utf8');
      const reviewerAgent = await readFile(reviewerAgentPath, 'utf8');
      expect(workerAgent).toContain('sessionStrategy: fork-at');
      expect(reviewerAgent).toContain('sessionStrategy: fork-at');
    });
  });

  test('Modes extension bootstraps starter global presets on first run', async () => {
    await withTempHome(async (homeDir) => {
      await withTempModesGlobalPath(homeDir, async (presetsPath) => {
        const pi = createMockPi();
        for (const toolName of [
          'read',
          'bash',
          'edit',
          'write',
          'lsp',
          'questionnaire',
          'context7_resolve_library_id',
          'context7_get_library_docs',
        ]) {
          pi.api.registerTool({ name: toolName });
        }

        const { default: modesExtension } = await import(
          `../packages/modes/extensions/modes/index.ts?bootstrap=${Date.now()}-${Math.random()}`
        );
        modesExtension(pi.api as any);

        const projectDir = path.join(homeDir, 'project');
        await mkdir(projectDir, { recursive: true });
        const ctx = createMockContext({ cwd: projectDir, hasUI: false });
        await pi.emit('session_start', { reason: 'startup' }, ctx);

        const content = JSON.parse(await readFile(presetsPath, 'utf8')) as Record<string, any>;
        expect(content.explore.tools).toEqual(['read', 'lsp', 'context7_*', 'questionnaire']);
        expect(content.explore.thinkingLevel).toBe('high');
        expect(
          ctx.notifications.some((entry) =>
            entry.message.includes('created starter global presets'),
          ),
        ).toBe(true);
      });
    });
  });

  test('Modes extension adds missing starter presets without overwriting existing global ones', async () => {
    await withTempHome(async (homeDir) => {
      await withTempModesGlobalPath(homeDir, async (presetsPath) => {
        await mkdir(path.dirname(presetsPath), { recursive: true });
        await writeFile(
          presetsPath,
          JSON.stringify(
            {
              explore: {
                tools: ['read'],
                instructions: 'Custom user explore preset',
              },
            },
            null,
            2,
          ),
        );

        const pi = createMockPi();
        for (const toolName of ['read', 'lsp', 'questionnaire']) {
          pi.api.registerTool({ name: toolName });
        }

        const { default: modesExtension } = await import(
          `../packages/modes/extensions/modes/index.ts?preserve=${Date.now()}-${Math.random()}`
        );
        modesExtension(pi.api as any);

        const projectDir = path.join(homeDir, 'project');
        await mkdir(projectDir, { recursive: true });
        const ctx = createMockContext({ cwd: projectDir, hasUI: false });
        await pi.emit('session_start', { reason: 'startup' }, ctx);

        const content = JSON.parse(await readFile(presetsPath, 'utf8')) as Record<string, any>;
        expect(content.explore.tools).toEqual(['read']);
        expect(content.explore.instructions).toBe('Custom user explore preset');
        expect(
          ctx.notifications.some((entry) =>
            entry.message.includes('created starter global presets'),
          ),
        ).toBe(false);
      });
    });
  });

  test('Modes extension applies explore preset from config and restores defaults when cleared', async () => {
    await withTempHome(async (homeDir) => {
      await withTempModesGlobalPath(homeDir, async () => {
        const projectDir = path.join(homeDir, 'project');
        const presetsPath = path.join(projectDir, '.pi', 'presets.json');
        await mkdir(path.dirname(presetsPath), { recursive: true });
        await writeFile(
          presetsPath,
          JSON.stringify(
            {
              explore: {
                tools: ['read', 'lsp', 'context7_*', 'questionnaire'],
                thinkingLevel: 'high',
                instructions: 'Explore only. Do not modify files.',
              },
            },
            null,
            2,
          ),
        );

        const pi = createMockPi();
        for (const toolName of [
          'read',
          'bash',
          'edit',
          'write',
          'lsp',
          'questionnaire',
          'context7_resolve_library_id',
          'context7_get_library_docs',
          'subagent',
        ]) {
          pi.api.registerTool({ name: toolName });
        }
        pi.setFlag('preset', 'explore');

        const { default: modesExtension } = await import(
          `../packages/modes/extensions/modes/index.ts?apply=${Date.now()}-${Math.random()}`
        );
        modesExtension(pi.api as any);

        expect([...pi.commands.keys()].sort()).toEqual(['mode', 'modes', 'preset']);
        expect(pi.countHandlers('session_start')).toBeGreaterThan(0);
        expect(pi.countHandlers('input')).toBeGreaterThan(0);
        expect(pi.countHandlers('before_agent_start')).toBeGreaterThan(0);

        const ctx = createMockContext({ cwd: projectDir, hasUI: false });
        await pi.emit('session_start', { reason: 'startup' }, ctx);

        const presetCompletions = await pi.getCommand('preset').getArgumentCompletions?.('ex');
        expect(presetCompletions?.some((item) => item.value === 'explore')).toBe(true);
        const modeCompletions = await pi.getCommand('mode').getArgumentCompletions?.('off');
        expect(modeCompletions?.some((item) => item.value === 'off')).toBe(true);

        const inputResults = await pi.emit(
          'input',
          { source: 'interactive', text: '/explore' },
          ctx,
        );
        expect(inputResults[0]).toEqual({ action: 'transform', text: '/preset explore' });

        expect(pi.api.getActiveTools()).toEqual([
          'read',
          'lsp',
          'context7_resolve_library_id',
          'context7_get_library_docs',
          'questionnaire',
        ]);
        expect(ctx.statuses.get('mode')).toBe('mode:explore');

        const beforeAgentStartResults = await pi.emit(
          'before_agent_start',
          {
            prompt: 'inspect the repo',
            images: [],
            systemPrompt: 'Base prompt',
            systemPromptOptions: {
              selectedTools: ['read', 'questionnaire'],
            },
          },
          ctx,
        );
        expect(beforeAgentStartResults[0]).toEqual({
          systemPrompt:
            'Base prompt\n\nCurrent mode: explore\n\nEnabled tools: read, questionnaire\n\nExplore only. Do not modify files.',
        });

        await pi.getCommand('preset').handler?.('off', ctx);
        expect(pi.api.getActiveTools()).toEqual([
          'read',
          'bash',
          'edit',
          'write',
          'lsp',
          'questionnaire',
          'context7_resolve_library_id',
          'context7_get_library_docs',
          'subagent',
        ]);
        expect(ctx.statuses.get('mode')).toBeUndefined();
      });
    });
  });

  test('Plan mode extension enforces read-only planning and can fall back to plan-file prompts', async () => {
    const pi = createMockPi();
    for (const toolName of [
      'read',
      'bash',
      'grep',
      'find',
      'ls',
      'edit',
      'write',
      'questionnaire',
      'lsp',
      'context7_get_library_docs',
    ]) {
      pi.api.registerTool({ name: toolName });
    }
    pi.setFlag('plan', true);

    const { default: planModeExtension } = await import(
      `../packages/plan-mode/extensions/plan-mode/index.ts?plan=${Date.now()}-${Math.random()}`
    );
    planModeExtension(pi.api as any);

    expect([...pi.commands.keys()].sort()).toEqual([
      'plan',
      'plan-domain',
      'plan-execute',
      'plan-plans',
      'plan-status',
    ]);
    expect(pi.countHandlers('session_start')).toBeGreaterThan(0);
    expect(pi.countHandlers('before_agent_start')).toBeGreaterThan(0);
    expect(pi.countHandlers('tool_call')).toBeGreaterThan(0);

    const ctx = createMockContext({ hasUI: false });
    await pi.emit('session_start', { reason: 'startup' }, ctx);

    const planCompletions = await pi.getCommand('plan').getArgumentCompletions?.('sta');
    expect(planCompletions?.some((item) => item.value === 'status')).toBe(true);

    expect(pi.api.getActiveTools()).toEqual([
      'read',
      'bash',
      'grep',
      'find',
      'ls',
      'questionnaire',
      'lsp',
      'context7_get_library_docs',
    ]);
    expect(ctx.statuses.get('plan-mode')).toBe('plan');

    const beforeAgentStartResults = await pi.emit(
      'before_agent_start',
      {
        prompt: 'plan this feature',
        images: [],
        systemPrompt: 'Base prompt',
        systemPromptOptions: {
          selectedTools: ['read', 'questionnaire'],
        },
      },
      ctx,
    );
    expect(beforeAgentStartResults[0].systemPrompt).toContain('PLAN MODE ACTIVE.');
    expect(beforeAgentStartResults[0].systemPrompt).toContain('Enabled tools: read, questionnaire');
    expect(beforeAgentStartResults[0].systemPrompt).toContain('questionnaire tool is available');

    const toolCallResults = await pi.emit(
      'tool_call',
      {
        toolName: 'bash',
        input: { command: 'rm -rf build' },
      },
      ctx,
    );
    expect(toolCallResults[0]).toEqual(
      expect.objectContaining({
        block: true,
      }),
    );

    await pi.getCommand('plan-plans').handler?.('', ctx);
    expect(pi.api.getActiveTools()).toEqual([
      'read',
      'bash',
      'grep',
      'find',
      'ls',
      'edit',
      'write',
      'questionnaire',
      'lsp',
      'context7_get_library_docs',
    ]);
    expect(pi.sentMessages.at(-1)).toEqual(
      expect.objectContaining({
        type: 'user',
        message: expect.stringContaining(
          'Create self-contained implementation plan files for the current approved plan.',
        ),
      }),
    );
  });
});
