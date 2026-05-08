/**
 * Plan Mode Extension
 *
 * Two-phase workflow:
 *   1. PLAN phase  — read-only tools (+ edit/write for .plans/ only) + medium thinking
 *                    Planner analyzes codebase, asks questions, writes PLAN.md + START-PROMPT.md
 *   2. EXECUTE phase — full tools + low thinking, clean context from START-PROMPT.md
 *                      Executor works through the plan step by step with [DONE:n] tracking
 *
 * Plans live in `.plans/<kebab-name>/PLAN.md` with a `START-PROMPT.md` sibling for clean handoff.
 *
 * Commands:
 *   /plan [prompt]  — enter plan mode (optionally with a starting prompt)
 *   /todos          — show current plan progress
 *   Ctrl+Alt+P      — toggle plan mode (shortcut)
 *
 * Flag:
 *   --plan          — start session in plan mode
 */

import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, TextContent } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Key } from '@earendil-works/pi-tui';
import {
  extractTodoItems,
  isSafeCommand,
  markCompletedSteps,
  type TodoItem,
} from './utils.js';

// ── Tool sets ────────────────────────────────────────────────────────────────
// Plan phase: read-only + edit/write (for .plans/ files only, enforced by prompt)
const PLAN_TOOLS = [
  'read',
  'bash',
  'grep',
  'find',
  'ls',
  'edit',
  'write',
  'questionnaire',
  'search_skills',
];
const EXEC_TOOLS = ['read', 'bash', 'edit', 'write', 'search_skills'];

// ── Model + thinking presets ─────────────────────────────────────────────────
const PLAN_MODEL = { provider: 'anthropic', id: 'claude-opus-4-6' } as const;
const PLAN_THINKING = 'medium' as const;

const EXEC_MODEL = { provider: 'openai', id: 'gpt-5.5' } as const;
const EXEC_THINKING = 'low' as const;

type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

// ── Persisted state ──────────────────────────────────────────────────────────
interface PersistedState {
  planEnabled: boolean;
  executing: boolean;
  planDir: string | undefined;
  todos: TodoItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
  return m.role === 'assistant' && Array.isArray(m.content);
}

function getTextContent(message: AssistantMessage): string {
  return message.content
    .filter((b): b is TextContent => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

// ── Extension ────────────────────────────────────────────────────────────────
export default function planMode(pi: ExtensionAPI): void {
  let planEnabled = false;
  let executing = false;
  let planDir: string | undefined;
  let todos: TodoItem[] = [];
  let previousThinking: ThinkingLevel | undefined;
  let previousModel: { provider: string; id: string } | undefined;

  // ── Flag ──────────────────────────────────────────────────────────────────
  pi.registerFlag('plan', {
    description: 'Start in plan mode (read-only + medium thinking)',
    type: 'boolean',
    default: false,
  });

  // ── State persistence ─────────────────────────────────────────────────────
  function persist(): void {
    pi.appendEntry<PersistedState>('plan-mode', {
      planEnabled,
      executing,
      planDir,
      todos,
    });
  }

  // ── UI updates ────────────────────────────────────────────────────────────
  function updateUI(ctx: ExtensionContext): void {
    const { theme } = ctx.ui;

    if (executing && todos.length > 0) {
      const done = todos.filter((t) => t.completed).length;
      ctx.ui.setStatus('plan-mode', theme.fg('accent', `📋 exec ${done}/${todos.length}`));
    } else if (planEnabled) {
      ctx.ui.setStatus('plan-mode', theme.fg('warning', '📝 plan'));
    } else {
      ctx.ui.setStatus('plan-mode', undefined);
    }

    if (executing && todos.length > 0) {
      const lines = todos.map((item) => {
        if (item.completed) {
          return theme.fg('success', '☑ ') + theme.fg('muted', theme.strikethrough(item.text));
        }
        return `${theme.fg('muted', '☐ ')}${item.text}`;
      });
      ctx.ui.setWidget('plan-todos', lines);
    } else {
      ctx.ui.setWidget('plan-todos', undefined);
    }
  }

  // ── Model switching ───────────────────────────────────────────────────────
  async function switchModel(
    ctx: ExtensionContext,
    preset: { provider: string; id: string },
  ): Promise<boolean> {
    const model = ctx.modelRegistry.find(preset.provider, preset.id);
    if (!model) {
      ctx.ui.notify(`Model ${preset.provider}/${preset.id} not found`, 'error');
      return false;
    }
    const ok = await pi.setModel(model);
    if (!ok) {
      ctx.ui.notify(`No API key for ${preset.provider}/${preset.id}`, 'error');
      return false;
    }
    return true;
  }

  // ── Phase transitions ─────────────────────────────────────────────────────
  async function enterPlanMode(ctx: ExtensionContext): Promise<void> {
    planEnabled = true;
    executing = false;
    planDir = undefined;
    todos = [];
    previousThinking = pi.getThinkingLevel() as ThinkingLevel;
    previousModel = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
    pi.setActiveTools(PLAN_TOOLS);
    await switchModel(ctx, PLAN_MODEL);
    pi.setThinkingLevel(PLAN_THINKING);
    ctx.ui.notify(
      `Plan mode ON — ${PLAN_MODEL.provider}/${PLAN_MODEL.id}:${PLAN_THINKING}`,
      'info',
    );
    updateUI(ctx);
    persist();
  }

  async function exitPlanMode(ctx: ExtensionContext): Promise<void> {
    planEnabled = false;
    executing = false;
    planDir = undefined;
    todos = [];
    pi.setActiveTools(EXEC_TOOLS);
    if (previousModel) {
      await switchModel(ctx, previousModel);
    }
    if (previousThinking) {
      pi.setThinkingLevel(previousThinking);
    }
    ctx.ui.notify('Plan mode OFF — original model restored', 'info');
    updateUI(ctx);
    persist();
  }

  async function startExecution(ctx: ExtensionContext): Promise<void> {
    planEnabled = false;
    executing = true;
    pi.setActiveTools(EXEC_TOOLS);
    await switchModel(ctx, EXEC_MODEL);
    pi.setThinkingLevel(EXEC_THINKING);
    ctx.ui.notify(
      `Executing plan — ${EXEC_MODEL.provider}/${EXEC_MODEL.id}:${EXEC_THINKING}`,
      'info',
    );
    updateUI(ctx);
    persist();
  }

  async function togglePlanMode(ctx: ExtensionContext): Promise<void> {
    if (planEnabled || executing) {
      await exitPlanMode(ctx);
    } else {
      await enterPlanMode(ctx);
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  pi.registerCommand('plan', {
    description: 'Enter plan mode, optionally with a starting prompt',
    handler: async (args, ctx) => {
      if (planEnabled || executing) {
        await togglePlanMode(ctx);
        return;
      }
      await enterPlanMode(ctx);
      const prompt = args?.trim();
      if (prompt) {
        pi.sendUserMessage(prompt);
      }
    },
  });

  pi.registerCommand('todos', {
    description: 'Show current plan progress',
    handler: async (_args, ctx) => {
      if (todos.length === 0) {
        ctx.ui.notify('No plan yet. Use /plan to start planning.', 'info');
        return;
      }
      const list = todos
        .map((t, i) => `${i + 1}. ${t.completed ? '✓' : '○'} ${t.text}`)
        .join('\n');
      ctx.ui.notify(`Plan Progress:\n${list}`, 'info');
    },
  });

  pi.registerShortcut(Key.ctrlAlt('p'), {
    description: 'Toggle plan mode',
    handler: async (ctx) => togglePlanMode(ctx),
  });

  // ── Block destructive bash in plan mode ───────────────────────────────────
  pi.on('tool_call', async (event) => {
    if (!planEnabled) return;

    // Block bash commands that aren't on the safe allowlist
    if (event.toolName === 'bash') {
      const command = event.input.command as string;
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `Plan mode: command blocked. Use /plan to exit plan mode first.\nCommand: ${command}`,
        };
      }
    }

    // Block edit/write to paths outside .plans/
    if (event.toolName === 'edit' || event.toolName === 'write') {
      const path = (event.input as { path?: string }).path ?? '';
      if (!path.startsWith('.plans/') && !path.startsWith('.plans\\')) {
        return {
          block: true,
          reason: `Plan mode: file modifications are restricted to .plans/ directory.\nPath: ${path}`,
        };
      }
    }
  });

  // ── Filter stale plan context when not planning ───────────────────────────
  pi.on('context', async (event) => {
    if (planEnabled) return;
    return {
      messages: event.messages.filter((m) => {
        const msg = m as AgentMessage & { customType?: string };
        if (msg.customType === 'plan-mode-context') return false;
        if (msg.role !== 'user') return true;
        const content = msg.content;
        if (typeof content === 'string') {
          return !content.includes('[PLAN MODE ACTIVE]');
        }
        if (Array.isArray(content)) {
          return !content.some(
            (c) => c.type === 'text' && (c as TextContent).text?.includes('[PLAN MODE ACTIVE]'),
          );
        }
        return true;
      }),
    };
  });

  // ── Inject context for each phase ─────────────────────────────────────────
  pi.on('before_agent_start', async () => {
    if (planEnabled) {
      return {
        message: {
          customType: 'plan-mode-context',
          content: `[PLAN MODE ACTIVE]
You are in plan mode — a planning phase with strict bash restrictions.

Restrictions:
- Available tools: ${PLAN_TOOLS.join(', ')}
- Bash is restricted to read-only commands (ls, grep, git status, etc.)
- edit and write are ONLY allowed for files inside the \`.plans/\` directory

Your task:
1. Analyze the codebase thoroughly using the available read-only tools
2. Ask clarifying questions if needed (use the questionnaire tool)
3. Produce a detailed, concrete plan

When you are ready to finalize the plan:
1. Choose a short descriptive kebab-case name for the plan (e.g. "add-auth-middleware")
2. Create \`.plans/<plan-name>/PLAN.md\` with the full numbered plan under a \`Plan:\` header:

\`\`\`markdown
# <Plan Title>

<Brief description of what this plan accomplishes>

## Context
<Key findings from codebase analysis>

## Plan:
1. First step — what to change and where
2. Second step — what to change and where
...

## Risks / Open Questions
<Any concerns or assumptions>
\`\`\`

3. Create \`.plans/<plan-name>/START-PROMPT.md\` — a self-contained handoff prompt that a different model can use to execute the plan WITHOUT access to this conversation. It must include:
   - Complete context about the codebase (relevant file paths, APIs, patterns)
   - The full plan steps to execute
   - Any critical constraints or gotchas
   - Clear instructions to mark each step done with \`[DONE:n]\` tags

The START-PROMPT.md is critical — it must be thorough enough that an implementor with zero prior context can execute the plan correctly.

If you need supporting reference files for extra context (code snippets, diagrams, specs), place them alongside in the same \`.plans/<plan-name>/\` directory.

Do NOT attempt to make product code changes — only create planning artifacts in \`.plans/\`.`,
          display: false,
        },
      };
    }

    if (executing && todos.length > 0) {
      const remaining = todos.filter((t) => !t.completed);
      const todoList = remaining.map((t) => `${t.step}. ${t.text}`).join('\n');
      return {
        message: {
          customType: 'plan-execution-context',
          content: `[EXECUTING PLAN — Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order. You MUST include [DONE:n] in your response after completing each step before moving to the next one.`,
          display: false,
        },
      };
    }
  });

  // ── Track [DONE:n] markers during execution ───────────────────────────────
  pi.on('turn_end', async (event, ctx) => {
    if (!executing || todos.length === 0) return;
    if (!isAssistantMessage(event.message)) return;

    const text = getTextContent(event.message);
    if (markCompletedSteps(text, todos) > 0) {
      updateUI(ctx);
    }
    persist();
  });

  // ── Detect plan directory from written files ──────────────────────────────
  pi.on('tool_result', async (event) => {
    if (!planEnabled) return;
    if (event.toolName !== 'write' && event.toolName !== 'edit') return;
    if (event.isError) return;

    const path = (event.input as { path?: string }).path;
    if (!path) return;

    // Detect .plans/<name>/ directory from written files
    const match = path.match(/\.plans\/([^/]+)\//);
    if (match && !planDir) {
      planDir = `.plans/${match[1]}`;
      persist();
    }
  });

  // ── After agent finishes: prompt for next action ──────────────────────────
  pi.on('agent_end', async (event, ctx) => {
    // Check execution completion
    if (executing && todos.length > 0) {
      if (todos.every((t) => t.completed)) {
        const list = todos.map((t) => `~~${t.text}~~`).join('\n');
        pi.sendMessage(
          {
            customType: 'plan-complete',
            content: `**Plan Complete!** ✓\n\n${list}`,
            display: true,
          },
          { triggerTurn: false },
        );
        executing = false;
        todos = [];
        planDir = undefined;
        pi.setActiveTools(EXEC_TOOLS);
        if (previousModel) {
          await switchModel(ctx, previousModel);
        }
        if (previousThinking) {
          pi.setThinkingLevel(previousThinking);
        }
        updateUI(ctx);
        persist();
      }
      return;
    }

    if (!planEnabled || !ctx.hasUI) return;

    // Check if plan files were created by looking for planDir
    if (!planDir) return;

    // Show menu
    const choice = await ctx.ui.select('Plan ready — what next?', [
      'Execute Plan',
      'Refine Plan',
      'Follow up',
      'Exit plan mode',
    ]);

    if (choice === 'Execute Plan') {
      // Read START-PROMPT.md for clean context handoff
      const startPromptPath = `${planDir}/START-PROMPT.md`;
      const planMdPath = `${planDir}/PLAN.md`;

      // Read the plan to extract todos
      let planContent = '';
      try {
        const result = await pi.exec('cat', [planMdPath]);
        if (result.code === 0) {
          planContent = result.stdout;
        }
      } catch {
        // Fall through — will use empty plan content
      }

      const extracted = extractTodoItems(planContent);
      if (extracted.length > 0) {
        todos = extracted;
      }

      // Read the start prompt for clean handoff
      let startPrompt = '';
      try {
        const result = await pi.exec('cat', [startPromptPath]);
        if (result.code === 0) {
          startPrompt = result.stdout.trim();
        }
      } catch {
        // Fall through
      }

      await startExecution(ctx);
      updateUI(ctx);

      if (startPrompt) {
        pi.sendMessage(
          {
            customType: 'plan-mode-execute',
            content: startPrompt,
            display: true,
          },
          { triggerTurn: true },
        );
      } else {
        // Fallback: ask executor to read the plan
        pi.sendMessage(
          {
            customType: 'plan-mode-execute',
            content: `Execute the plan in ${planMdPath}. Read it first, then execute step by step. Mark each step with [DONE:n] before moving to the next.`,
            display: true,
          },
          { triggerTurn: true },
        );
      }
    } else if (choice === 'Refine Plan') {
      // Adversarial review — planner critiques its own plan
      pi.sendMessage(
        {
          customType: 'plan-mode-refine',
          content: `Review the plan you just created in ${planDir}/PLAN.md with an adversarial lens. Challenge assumptions, find gaps, identify risks, and look for:

- Missing edge cases or error handling
- Incorrect assumptions about the codebase
- Steps that are too vague or could be misinterpreted
- Missing dependencies between steps
- Simpler alternatives that were overlooked

After your review, update PLAN.md and START-PROMPT.md with any improvements.`,
          display: true,
        },
        { triggerTurn: true },
      );
    } else if (choice === 'Follow up') {
      const followUp = await ctx.ui.editor('Follow-up instructions for the planner:', '');
      if (followUp?.trim()) {
        pi.sendUserMessage(followUp.trim());
      }
    } else if (choice === 'Exit plan mode') {
      await exitPlanMode(ctx);
    }
  });

  // ── Restore state on session start/resume ─────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    // Check CLI flag
    if (pi.getFlag('plan') === true) {
      planEnabled = true;
    }

    // Restore persisted state
    const entries = ctx.sessionManager.getEntries();
    const saved = entries
      .filter(
        (e: { type: string; customType?: string }) =>
          e.type === 'custom' && e.customType === 'plan-mode',
      )
      .pop() as { data?: PersistedState } | undefined;

    if (saved?.data) {
      planEnabled = saved.data.planEnabled ?? planEnabled;
      executing = saved.data.executing ?? executing;
      planDir = saved.data.planDir ?? planDir;
      todos = saved.data.todos ?? todos;
    }

    // Re-scan [DONE:n] markers on resume
    if (executing && todos.length > 0) {
      let execIdx = -1;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i] as { type: string; customType?: string };
        if (entry.customType === 'plan-mode-execute') {
          execIdx = i;
          break;
        }
      }

      const messages: AssistantMessage[] = [];
      for (let i = execIdx + 1; i < entries.length; i++) {
        const entry = entries[i];
        if (
          entry.type === 'message' &&
          'message' in entry &&
          isAssistantMessage(entry.message as AgentMessage)
        ) {
          messages.push(entry.message as AssistantMessage);
        }
      }
      const allText = messages.map(getTextContent).join('\n');
      markCompletedSteps(allText, todos);
    }

    // Apply tool restrictions, model, and thinking level
    if (planEnabled) {
      pi.setActiveTools(PLAN_TOOLS);
      await switchModel(ctx, PLAN_MODEL);
      pi.setThinkingLevel(PLAN_THINKING);
    } else if (executing) {
      pi.setActiveTools(EXEC_TOOLS);
      await switchModel(ctx, EXEC_MODEL);
      pi.setThinkingLevel(EXEC_THINKING);
    }

    updateUI(ctx);
  });
}
