import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent';
import { Key, type AutocompleteItem } from '@mariozechner/pi-tui';
import {
  extractTodoItems,
  formatTodoList,
  isSafeCommand,
  markCompletedSteps,
  type TodoItem,
} from './utils.js';

type WorkflowPhase = 'off' | 'planning' | 'plan-files' | 'executing';

interface PersistedState {
  phase: WorkflowPhase;
  todos: TodoItem[];
}

interface BeforeAgentStartCompatEvent {
  systemPromptOptions?: {
    selectedTools?: string[];
  };
}

const STATE_ENTRY = 'plan-mode-state';
const CLEAR_VALUES = new Set(['', 'off', 'none', 'disable', 'exit']);
const PLANNING_TOOL_PATTERNS = [
  'read',
  'bash',
  'grep',
  'find',
  'ls',
  'questionnaire',
  'lsp',
] as const;
const PLAN_FILE_TOOL_PATTERNS = [...PLANNING_TOOL_PATTERNS, 'edit', 'write'] as const;

function isAssistantMessage(message: unknown): message is {
  role: 'assistant';
  content: Array<{ type: string; text?: string }>;
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'role' in message &&
    (message as { role?: unknown }).role === 'assistant' &&
    'content' in message &&
    Array.isArray((message as { content?: unknown }).content)
  );
}

function getMessageText(message: unknown): string {
  if (!isAssistantMessage(message)) return '';
  return message.content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        block.type === 'text' && typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('\n');
}

function matchesToolPattern(name: string, pattern: string): boolean {
  if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

function resolveToolNames(allToolNames: string[], patterns: readonly string[]): string[] {
  return allToolNames.filter((name) =>
    patterns.some(
      (pattern) =>
        matchesToolPattern(name, pattern) ||
        (pattern === 'context7_*' && name.startsWith('context7_')),
    ),
  );
}

function findSavedState(ctx: ExtensionContext): PersistedState | undefined {
  const branchEntries = ctx.sessionManager.getBranch?.() ?? ctx.sessionManager.getEntries?.() ?? [];
  let lastState: PersistedState | undefined;

  for (const entry of branchEntries) {
    if (entry.type !== 'custom' || entry.customType !== STATE_ENTRY) continue;
    const data = entry.data as PersistedState | undefined;
    if (data && typeof data.phase === 'string' && Array.isArray(data.todos)) lastState = data;
  }

  return lastState;
}

function buildPlanningInstructions(
  ctx: ExtensionContext,
  activeTools: string[],
  todos: TodoItem[],
): string {
  const sections = [
    'PLAN MODE ACTIVE.',
    'Run a Cursor-style planning pass before implementation.',
    `Enabled tools: ${activeTools.length > 0 ? activeTools.join(', ') : '(none)'}`,
    'Rules:',
    '- Stay read-only. Do not edit files or claim to have changed code.',
    '- Inspect the real codebase before proposing work. Do not guess from filenames.',
    '- If requirements are underspecified and the questionnaire tool is available, use it to ask 1-5 structured clarifying questions before finalizing the plan.',
    '- Produce a concrete numbered plan under a `Plan:` header.',
    '- Include open questions, assumptions, risks, and sequencing when relevant.',
    '- If the user wants terminology hardened or the design pressure-tested, point them to the domain-model workflow.',
    '- If the user wants self-contained handoff files, point them to the implementation-plan workflow.',
  ];

  if (ctx.hasUI) {
    sections.push(
      'After the planning response, the extension may offer next-step choices like domain-model review, implementation-plan generation, or execution.',
    );
  }

  if (todos.length > 0) {
    sections.push(`Current plan draft:\n${formatTodoList(todos)}`);
  }

  return sections.join('\n');
}

function buildPlanFileInstructions(activeTools: string[], todos: TodoItem[]): string {
  const sections = [
    'PLAN FILE AUTHORING MODE ACTIVE.',
    `Enabled tools: ${activeTools.length > 0 ? activeTools.join(', ') : '(none)'}`,
    'You may use edit/write in this phase, but only to author planning artifacts such as `*.plan.md`, `CONTEXT.md`, or ADR docs requested by the workflow.',
    'Do not implement product code in this phase.',
    'Ground every plan file in the current codebase state.',
  ];

  if (todos.length > 0) {
    sections.push(`Current approved plan:\n${formatTodoList(todos)}`);
  }

  return sections.join('\n');
}

function buildExecutionInstructions(todos: TodoItem[]): string {
  const sections = [
    'PLAN EXECUTION MODE ACTIVE.',
    'Execute the approved plan in small verified steps.',
    'After completing a plan step, include a `[DONE:n]` tag in the response so progress can be tracked.',
  ];

  if (todos.length > 0) {
    sections.push(`Current checklist:\n${formatTodoList(todos)}`);
  }

  return sections.join('\n');
}

export default function planModeExtension(pi: ExtensionAPI) {
  let phase: WorkflowPhase = 'off';
  let restoreToolNames: string[] | null = null;
  let todoItems: TodoItem[] = [];
  let returnToPlanningAfterNextAgentEnd = false;

  function getPlanCommandCompletions(argumentText: string): AutocompleteItem[] | null {
    if (argumentText.trim().includes(' ')) return null;

    const query = argumentText.trim().toLowerCase();
    const items: AutocompleteItem[] = [
      {
        value: 'status',
        label: 'status',
        description: `Show the current plan workflow state (currently ${phase})`,
      },
      {
        value: 'domain',
        label: 'domain',
        description: 'Stress-test the current plan with a domain-model review',
      },
      {
        value: 'plans',
        label: 'plans',
        description: 'Generate self-contained implementation plan files',
      },
      {
        value: 'execute',
        label: 'execute',
        description: 'Leave read-only planning and execute the approved plan',
      },
      {
        value: 'off',
        label: 'off',
        description: 'Disable plan mode',
      },
    ];

    const filtered = items.filter((item) => {
      if (!query) return true;
      return (
        item.value.toLowerCase().startsWith(query) ||
        item.label?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    });

    return filtered.length > 0 ? filtered : null;
  }

  pi.registerFlag('plan', {
    description: 'Start in plan mode (Cursor-style planning workflow)',
    type: 'boolean',
    default: false,
  });

  function persistState() {
    pi.appendEntry<PersistedState>(STATE_ENTRY, {
      phase,
      todos: todoItems.map((item) => ({ ...item })),
    });
  }

  function updateUi(ctx: ExtensionContext) {
    if (phase === 'off') {
      ctx.ui.setStatus('plan-mode', undefined);
      ctx.ui.setWidget('plan-mode-todos', undefined);
      return;
    }

    if (phase === 'planning') {
      ctx.ui.setStatus('plan-mode', ctx.ui.theme.fg('warning', 'plan'));
    } else if (phase === 'plan-files') {
      ctx.ui.setStatus('plan-mode', ctx.ui.theme.fg('accent', 'plan:files'));
    } else {
      const completed = todoItems.filter((item) => item.completed).length;
      const total = todoItems.length;
      ctx.ui.setStatus(
        'plan-mode',
        ctx.ui.theme.fg('success', total > 0 ? `plan:exec ${completed}/${total}` : 'plan:exec'),
      );
    }

    if (todoItems.length === 0) {
      ctx.ui.setWidget('plan-mode-todos', undefined);
      return;
    }

    const lines = todoItems.map((item) => {
      if (item.completed) {
        return ctx.ui.theme.fg('success', `☑ ${ctx.ui.theme.strikethrough(item.text)}`);
      }
      const marker = phase === 'executing' ? '☐' : '•';
      return `${ctx.ui.theme.fg('muted', `${marker} `)}${item.text}`;
    });
    ctx.ui.setWidget('plan-mode-todos', lines);
  }

  function ensureRestoreTools() {
    if (restoreToolNames) return;
    restoreToolNames = [...pi.getActiveTools()];
  }

  function applyPhaseTools(targetPhase: WorkflowPhase) {
    const allToolNames = pi.getAllTools().map((tool) => tool.name);

    if (targetPhase === 'planning') {
      const resolved = resolveToolNames(allToolNames, [...PLANNING_TOOL_PATTERNS, 'context7_*']);
      if (resolved.length > 0) pi.setActiveTools(resolved);
      return;
    }

    if (targetPhase === 'plan-files') {
      const resolved = resolveToolNames(allToolNames, [...PLAN_FILE_TOOL_PATTERNS, 'context7_*']);
      if (resolved.length > 0) pi.setActiveTools(resolved);
      return;
    }

    if (targetPhase === 'executing' && restoreToolNames) {
      pi.setActiveTools([...restoreToolNames]);
    }
  }

  function setPhase(
    nextPhase: WorkflowPhase,
    ctx: ExtensionContext,
    options?: { notify?: string },
  ) {
    if (phase === 'off' && nextPhase !== 'off') ensureRestoreTools();
    if (nextPhase === 'off' && restoreToolNames) {
      pi.setActiveTools([...restoreToolNames]);
      restoreToolNames = null;
    } else {
      applyPhaseTools(nextPhase);
    }

    phase = nextPhase;
    updateUi(ctx);
    persistState();

    if (options?.notify) ctx.ui.notify(options.notify, 'info');
  }

  async function sendPlanningPrompt(prompt: string, ctx: ExtensionContext) {
    const commandCtx = ctx as ExtensionContext & { waitForIdle?: () => Promise<void> };
    if (typeof commandCtx.waitForIdle === 'function') {
      await commandCtx.waitForIdle();
    }
    pi.sendUserMessage(prompt.trim());
  }

  function availableCommand(name: string): string | undefined {
    const commands = pi.getCommands?.() ?? [];
    return commands.find((command) => command.name === name)?.name;
  }

  async function startPlanning(prompt: string | undefined, ctx: ExtensionContext) {
    setPhase('planning', ctx, {
      notify:
        phase === 'off'
          ? 'Plan mode enabled. Ask pi to inspect, question, and plan before implementation.'
          : undefined,
    });

    const trimmed = prompt?.trim();
    if (!trimmed) return;
    await sendPlanningPrompt(trimmed, ctx);
  }

  async function runDomainWorkflow(args: string | undefined, ctx: ExtensionContext) {
    setPhase('planning', ctx, { notify: 'Running domain-model review in read-only plan mode.' });

    const planText =
      todoItems.length > 0 ? formatTodoList(todoItems) : 'No extracted plan steps yet.';
    const trimmedArgs = args?.trim();
    const promptText =
      trimmedArgs && trimmedArgs.length > 0
        ? trimmedArgs
        : `Stress-test the current plan against the existing domain model and terminology. Challenge ambiguous terms, invent concrete scenarios, compare claims against the codebase, and suggest any CONTEXT.md or ADR updates only when justified.\n\nCurrent plan:\n${planText}`;
    const skillCommand = availableCommand('skill:domain-model');

    if (skillCommand) {
      const suffix =
        trimmedArgs && trimmedArgs.length > 0
          ? trimmedArgs
          : `Stress-test the current plan against the domain model.\n\nCurrent plan:\n${planText}`;
      await sendPlanningPrompt(`/${skillCommand} ${suffix}`.trim(), ctx);
      return;
    }

    await sendPlanningPrompt(promptText, ctx);
  }

  async function runPlanFileWorkflow(args: string | undefined, ctx: ExtensionContext) {
    setPhase('plan-files', ctx, {
      notify:
        'Plan-file authoring enabled. pi may write planning docs, but should not implement code.',
    });
    returnToPlanningAfterNextAgentEnd = true;

    const planText =
      todoItems.length > 0 ? formatTodoList(todoItems) : 'No extracted plan steps yet.';
    const trimmedArgs = args?.trim();
    const promptText =
      trimmedArgs && trimmedArgs.length > 0
        ? trimmedArgs
        : `Create self-contained implementation plan files for the current approved plan. Ground every file in the real codebase, document exact APIs and file paths, and write the plans to docs/plans unless the repo or user prefers another location.\n\nCurrent plan:\n${planText}`;
    const skillCommand = availableCommand('skill:create-implementation-plans');

    if (skillCommand) {
      const suffix =
        trimmedArgs && trimmedArgs.length > 0
          ? trimmedArgs
          : `Create self-contained implementation plan files for the current approved plan.\n\nCurrent plan:\n${planText}`;
      await sendPlanningPrompt(`/${skillCommand} ${suffix}`.trim(), ctx);
      return;
    }

    await sendPlanningPrompt(promptText, ctx);
  }

  async function startExecution(args: string | undefined, ctx: ExtensionContext) {
    setPhase('executing', ctx, {
      notify: 'Plan execution mode enabled. Full tool access restored.',
    });

    const trimmedArgs = args?.trim();
    if (trimmedArgs && trimmedArgs.length > 0) {
      await sendPlanningPrompt(trimmedArgs, ctx);
      return;
    }

    const defaultPrompt =
      todoItems.length > 0
        ? `Execute the approved plan in order.\n\nPlan:\n${formatTodoList(todoItems)}\n\nStart with step 1 and include [DONE:n] tags as each step is completed.`
        : 'Execute the approved plan in small verified steps. Include [DONE:n] tags as each major plan step is completed.';
    await sendPlanningPrompt(defaultPrompt, ctx);
  }

  function showStatus(ctx: ExtensionContext) {
    const lines = [`Phase: ${phase}`];
    if (todoItems.length > 0) {
      const completed = todoItems.filter((item) => item.completed).length;
      lines.push(`Plan steps: ${completed}/${todoItems.length} complete`);
      lines.push(
        '',
        ...todoItems.map((item) => `${item.step}. ${item.completed ? '✓' : '○'} ${item.text}`),
      );
    }
    ctx.ui.notify(lines.join('\n'), 'info');
  }

  async function showPlanMenu(ctx: ExtensionContext) {
    if (!ctx.hasUI) {
      showStatus(ctx);
      return;
    }

    const choice = await ctx.ui.select('Plan mode', [
      'Stay in planning mode',
      'Stress-test with domain-model',
      'Generate implementation plan files',
      'Execute current plan',
      'Show status',
      'Disable plan mode',
    ]);

    if (!choice || choice === 'Stay in planning mode') return;
    if (choice === 'Stress-test with domain-model') {
      await runDomainWorkflow(undefined, ctx);
      return;
    }
    if (choice === 'Generate implementation plan files') {
      await runPlanFileWorkflow(undefined, ctx);
      return;
    }
    if (choice === 'Execute current plan') {
      await startExecution(undefined, ctx);
      return;
    }
    if (choice === 'Show status') {
      showStatus(ctx);
      return;
    }

    setPhase('off', ctx, { notify: 'Plan mode disabled.' });
  }

  pi.registerCommand('plan', {
    description: 'Enable plan mode, send a planning prompt, or manage the plan workflow',
    getArgumentCompletions: getPlanCommandCompletions,
    handler: async (args, ctx) => {
      const raw = args?.trim() ?? '';
      if (!raw) {
        if (phase === 'off') {
          await startPlanning(undefined, ctx);
        } else {
          await showPlanMenu(ctx);
        }
        return;
      }

      const lower = raw.toLowerCase();
      if (CLEAR_VALUES.has(lower)) {
        setPhase('off', ctx, { notify: 'Plan mode disabled.' });
        return;
      }
      if (lower === 'status') {
        showStatus(ctx);
        return;
      }
      if (lower === 'domain') {
        await runDomainWorkflow(undefined, ctx);
        return;
      }
      if (lower === 'plans' || lower === 'files') {
        await runPlanFileWorkflow(undefined, ctx);
        return;
      }
      if (lower === 'execute' || lower === 'run') {
        await startExecution(undefined, ctx);
        return;
      }

      await startPlanning(raw, ctx);
    },
  });

  pi.registerCommand('plan-status', {
    description: 'Show current plan workflow phase and extracted plan steps',
    handler: async (_args, ctx) => {
      showStatus(ctx);
    },
  });

  pi.registerCommand('plan-domain', {
    description: 'Run a domain-model stress test for the current plan',
    handler: async (args, ctx) => {
      await runDomainWorkflow(args, ctx);
    },
  });

  pi.registerCommand('plan-plans', {
    description: 'Generate self-contained implementation plan files for the current plan',
    handler: async (args, ctx) => {
      await runPlanFileWorkflow(args, ctx);
    },
  });

  pi.registerCommand('plan-execute', {
    description: 'Leave read-only planning and execute the current approved plan',
    handler: async (args, ctx) => {
      await startExecution(args, ctx);
    },
  });

  pi.registerShortcut(Key.ctrlAlt('p'), {
    description: 'Toggle plan mode',
    handler: async (ctx) => {
      if (phase === 'off') setPhase('planning', ctx, { notify: 'Plan mode enabled.' });
      else setPhase('off', ctx, { notify: 'Plan mode disabled.' });
    },
  });

  pi.on('tool_call', async (event) => {
    if (phase !== 'planning' || event.toolName !== 'bash') return;

    const command = event.input.command as string;
    if (isSafeCommand(command)) return;

    return {
      block: true,
      reason: `Plan mode blocks non-read-only bash commands. Disable plan mode or use /plan-plans for controlled plan-file authoring.\nCommand: ${command}`,
    };
  });

  pi.on('before_agent_start', async (event, ctx) => {
    if (phase === 'off') return;

    const compatEvent = event as typeof event & BeforeAgentStartCompatEvent;
    const activeTools = compatEvent.systemPromptOptions?.selectedTools ?? pi.getActiveTools();

    if (phase === 'planning') {
      return {
        systemPrompt: `${event.systemPrompt}\n\n${buildPlanningInstructions(ctx, activeTools, todoItems)}`,
      };
    }

    if (phase === 'plan-files') {
      return {
        systemPrompt: `${event.systemPrompt}\n\n${buildPlanFileInstructions(activeTools, todoItems)}`,
      };
    }

    return {
      systemPrompt: `${event.systemPrompt}\n\n${buildExecutionInstructions(todoItems)}`,
    };
  });

  pi.on('turn_end', async (event, ctx) => {
    if (phase !== 'executing' || todoItems.length === 0) return;
    const text = getMessageText(event.message);
    if (!text) return;

    if (markCompletedSteps(text, todoItems) > 0) {
      updateUi(ctx);
      persistState();
    }
  });

  pi.on('agent_end', async (event, ctx) => {
    if (returnToPlanningAfterNextAgentEnd && phase === 'plan-files') {
      returnToPlanningAfterNextAgentEnd = false;
      setPhase('planning', ctx, { notify: 'Returned to read-only plan mode.' });
    }

    if (
      phase === 'executing' &&
      todoItems.length > 0 &&
      todoItems.every((item) => item.completed)
    ) {
      setPhase('off', ctx, { notify: 'Plan execution complete.' });
      todoItems = [];
      updateUi(ctx);
      persistState();
      return;
    }

    if (phase !== 'planning') return;

    const lastAssistantMessage = [...event.messages]
      .reverse()
      .find((message) => isAssistantMessage(message));
    if (!lastAssistantMessage) return;

    const extracted = extractTodoItems(getMessageText(lastAssistantMessage));
    if (extracted.length > 0) {
      todoItems = extracted;
      updateUi(ctx);
      persistState();
    }

    if (todoItems.length === 0 || !ctx.hasUI) return;

    const choice = await ctx.ui.select('Plan ready — what next?', [
      'Stay in planning mode',
      'Stress-test with domain-model',
      'Generate implementation plan files',
      'Execute current plan',
      'Refine the plan',
      'Disable plan mode',
    ]);

    if (!choice || choice === 'Stay in planning mode') return;
    if (choice === 'Stress-test with domain-model') {
      await runDomainWorkflow(undefined, ctx);
      return;
    }
    if (choice === 'Generate implementation plan files') {
      await runPlanFileWorkflow(undefined, ctx);
      return;
    }
    if (choice === 'Execute current plan') {
      await startExecution(undefined, ctx);
      return;
    }
    if (choice === 'Refine the plan') {
      const refinement = await ctx.ui.editor('Refine the plan:', '');
      if (refinement?.trim()) await sendPlanningPrompt(refinement, ctx);
      return;
    }

    setPhase('off', ctx, { notify: 'Plan mode disabled.' });
  });

  async function restoreState(ctx: ExtensionContext) {
    const savedState = findSavedState(ctx);

    if (pi.getFlag('plan') === true && !savedState) {
      ensureRestoreTools();
      phase = 'planning';
      applyPhaseTools(phase);
      updateUi(ctx);
      persistState();
      return;
    }

    if (!savedState) {
      phase = 'off';
      todoItems = [];
      updateUi(ctx);
      return;
    }

    todoItems = savedState.todos.map((item) => ({ ...item }));
    phase = savedState.phase;

    if (phase === 'planning' || phase === 'plan-files') {
      ensureRestoreTools();
      applyPhaseTools(phase);
    }

    updateUi(ctx);
  }

  pi.on('session_start', async (_event, ctx) => {
    await restoreState(ctx);
  });

  pi.on('session_tree', async (_event, ctx) => {
    await restoreState(ctx);
  });
}
