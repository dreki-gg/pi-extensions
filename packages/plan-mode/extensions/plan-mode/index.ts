/**
 * Plan Mode Extension
 *
 * Two-phase workflow:
 *   1. PLAN phase  — read-only tools + submit_plan tool + medium thinking
 *                    Planner analyzes codebase, calls submit_plan with structured data
 *   2. EXECUTE phase — full tools + update_step tool + low thinking
 *                      Executor works through plan steps, calling update_step for each
 *
 * Plans live in `.plans/<kebab-name>/plan.json` with structured steps and context.
 *
 * Commands:
 *   /plan [prompt]  — enter plan mode (optionally with a starting prompt)
 *   /todos          — show current plan progress
 *   Ctrl+Alt+P      — toggle plan mode (shortcut)
 *
 * Flag:
 *   --plan          — start session in plan mode
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Key } from '@earendil-works/pi-tui';
import { mkdir, writeFile } from 'node:fs/promises';
import { isSafeCommand } from './utils.js';
import { readPlansJson, serializePlansJson } from './plans-json.js';
import { registerSubmitPlanTool } from './tools/submit-plan.js';
import { registerUpdateStepTool } from './tools/update-step.js';
import type { PlanData, PersistedState } from './types.js';

// ── Tool sets ────────────────────────────────────────────────────────────────
const PLAN_TOOLS = [
  'read',
  'bash',
  'grep',
  'find',
  'ls',
  'submit_plan',
  'questionnaire',
  'search_skills',
];
const EXEC_TOOLS = ['read', 'bash', 'edit', 'write', 'update_step', 'search_skills'];

// ── Model + thinking presets ─────────────────────────────────────────────────
const PLAN_MODEL = { provider: 'anthropic', id: 'claude-opus-4-6' } as const;
const PLAN_THINKING = 'medium' as const;

const EXEC_MODEL = { provider: 'openai', id: 'gpt-5.5' } as const;
const EXEC_THINKING = 'low' as const;

type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

// ── Extension ────────────────────────────────────────────────────────────────
export default function planMode(pi: ExtensionAPI): void {
  let planEnabled = false;
  let executing = false;
  let planDir: string | undefined;
  let plan: PlanData | undefined;
  let executionStartIdx: number | undefined;
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
      plan,
      executionStartIdx,
    });
  }

  // ── plans.json tracking ───────────────────────────────────────────────────
  async function updatePlansManifest(
    planName: string,
    status: 'in-progress' | 'done',
    title?: string,
  ): Promise<void> {
    const manifest = await readPlansJson();
    const existing = manifest[planName];
    const now = new Date().toISOString();

    manifest[planName] = {
      status,
      title: title ?? existing?.title ?? 'Untitled plan',
      created: existing?.created ?? now,
      completed: status === 'done' ? now : null,
    };

    await mkdir('.plans', { recursive: true });
    await writeFile('.plans/plans.json', serializePlansJson(manifest), 'utf-8');
  }

  // ── Save plan.json to disk ────────────────────────────────────────────────
  async function savePlanToDisk(): Promise<void> {
    if (!planDir || !plan) return;
    await mkdir(planDir, { recursive: true });
    await writeFile(`${planDir}/plan.json`, JSON.stringify(plan, null, 2) + '\n', 'utf-8');
  }

  // ── UI updates ────────────────────────────────────────────────────────────
  function updateUI(ctx: ExtensionContext): void {
    const { theme } = ctx.ui;

    if (executing && plan) {
      const done = plan.steps.filter((s) => s.status === 'done').length;
      const total = plan.steps.length;
      ctx.ui.setStatus('plan-mode', theme.fg('accent', `📋 exec ${done}/${total}`));
    } else if (planEnabled) {
      ctx.ui.setStatus('plan-mode', theme.fg('warning', '📝 plan'));
    } else {
      ctx.ui.setStatus('plan-mode', undefined);
    }

    if (executing && plan) {
      const lines = plan.steps.map((step, i) => {
        const num = `${i + 1}. `;
        switch (step.status) {
          case 'done':
            return theme.fg('success', '✓ ') + theme.fg('muted', theme.strikethrough(num + step.description));
          case 'skipped':
            return theme.fg('warning', '⊘ ') + theme.fg('muted', theme.strikethrough(num + step.description));
          case 'blocked':
            return theme.fg('error', '✗ ') + theme.fg('error', num + step.description);
          default:
            return theme.fg('muted', '☐ ') + (num + step.description);
        }
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
    plan = undefined;
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
    plan = undefined;
    executionStartIdx = undefined;
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
    // Record message count so the context filter can drop the planning conversation
    executionStartIdx = ctx.sessionManager.getEntries().length;
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

  // ── Register tools ────────────────────────────────────────────────────────
  registerSubmitPlanTool(pi, {
    onPlanSubmitted: (dir, submittedPlan) => {
      planDir = dir;
      plan = submittedPlan;
      persist();
    },
  });

  registerUpdateStepTool(pi, {
    getPlan: () => plan,
    onStepUpdated: (step, status, notes) => {
      if (!plan) return;
      const stepIdx = step - 1;
      plan.steps[stepIdx].status = status;
      if (notes) plan.steps[stepIdx].notes = notes;
      persist();
    },
  });

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
      if (!plan || plan.steps.length === 0) {
        ctx.ui.notify('No plan yet. Use /plan to start planning.', 'info');
        return;
      }
      const statusIcon = { pending: '○', done: '✓', skipped: '⊘', blocked: '✗' };
      const list = plan.steps
        .map((s, i) => `${i + 1}. ${statusIcon[s.status]} ${s.description}`)
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

    if (event.toolName === 'bash') {
      const command = event.input.command as string;
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `Plan mode: command blocked. Use /plan to exit plan mode first.\nCommand: ${command}`,
        };
      }
    }
  });

  // ── Filter planning conversation when executing ──────────────────────────
  pi.on('context', async (event) => {
    if (planEnabled) return;

    if (executing && executionStartIdx !== undefined) {
      // During execution, drop everything from the planning phase.
      // The executor gets its context from the before_agent_start injection.
      const startIdx = executionStartIdx;
      return {
        messages: event.messages.filter((_m, i) => i >= startIdx),
      };
    }

    // Not executing — just strip stale plan-mode injected messages
    return {
      messages: event.messages.filter((m) => {
        const msg = m as { customType?: string; role?: string; content?: unknown };
        if (msg.customType === 'plan-mode-context') return false;
        if (msg.role !== 'user') return true;
        const content = msg.content;
        if (typeof content === 'string') {
          return !content.includes('[PLAN MODE ACTIVE]');
        }
        if (Array.isArray(content)) {
          return !content.some(
            (c: { type?: string; text?: string }) =>
              c.type === 'text' && c.text?.includes('[PLAN MODE ACTIVE]'),
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

Your task:
1. Analyze the codebase thoroughly using the available read-only tools
2. Ask clarifying questions if needed (use the questionnaire tool)
3. Produce a detailed, concrete plan

When you are ready to finalize the plan, call the submit_plan tool with:
- name: a short kebab-case name (e.g. "add-auth-middleware")
- title: a human-readable plan title
- context: complete codebase context including relevant file paths, APIs, patterns, constraints, and gotchas — this must be thorough enough that an implementor with zero prior context can execute the plan
- steps: an array of steps, each with a short description (≤60 chars for display) and detailed implementation instructions
- risks: any open questions, assumptions, or concerns

Do NOT attempt to make product code changes — only analyze and plan.
Do NOT write files manually — use submit_plan to finalize the plan.`,
          display: false,
        },
      };
    }

    if (executing && plan) {
      const remaining = plan.steps
        .map((s, i) => ({ ...s, num: i + 1 }))
        .filter((s) => s.status === 'pending');

      if (remaining.length === 0) return;

      const stepList = remaining
        .map((s) => `${s.num}. ${s.description}\n   Details: ${s.details}`)
        .join('\n\n');

      return {
        message: {
          customType: 'plan-execution-context',
          content: `[EXECUTING PLAN — Full tool access enabled]

Context:
${plan.context}

Remaining steps:
${stepList}

Execute each step in order. After completing each step, call the update_step tool to mark it done before moving to the next.
If a step is unnecessary, call update_step with status "skipped".
If a step cannot be completed, call update_step with status "blocked" and explain why in the notes.`,
          display: false,
        },
      };
    }
  });

  // ── Handle blocked steps and plan completion ──────────────────────────────
  pi.on('agent_end', async (_event, ctx) => {
    // Check for blocked steps during execution
    if (executing && plan) {
      const blocked = plan.steps
        .map((s, i) => ({ ...s, num: i + 1 }))
        .filter((s) => s.status === 'blocked');

      if (blocked.length > 0) {
        const blockedStep = blocked[0];
        const blockedInfo = blockedStep.notes
          ? `Step ${blockedStep.num}: ${blockedStep.description}\nReason: ${blockedStep.notes}`
          : `Step ${blockedStep.num}: ${blockedStep.description}`;

        const choice = await ctx.ui.select(`Step blocked — ${blockedInfo}\n\nWhat next?`, [
          'Skip this step',
          'Provide instructions',
          'Re-plan',
          'Abort execution',
        ]);

        if (choice === 'Skip this step') {
          plan.steps[blockedStep.num - 1].status = 'skipped';
          await savePlanToDisk();
          updateUI(ctx);
          persist();

          // Check if there are more pending steps
          const hasPending = plan.steps.some((s) => s.status === 'pending');
          if (hasPending) {
            pi.sendUserMessage('The blocked step has been skipped. Continue with the next step.', { deliverAs: 'followUp' });
          }
          // If no pending, fall through to completion check below
        } else if (choice === 'Provide instructions') {
          const instructions = await ctx.ui.editor('Instructions for the blocked step:', '');
          if (instructions?.trim()) {
            plan.steps[blockedStep.num - 1].status = 'pending';
            plan.steps[blockedStep.num - 1].notes = undefined;
            await savePlanToDisk();
            updateUI(ctx);
            persist();
            pi.sendUserMessage(
              `Retry step ${blockedStep.num} with these additional instructions: ${instructions.trim()}`,
              { deliverAs: 'followUp' },
            );
          }
          return;
        } else if (choice === 'Re-plan') {
          await enterPlanMode(ctx);
          pi.sendUserMessage(
            `Step ${blockedStep.num} was blocked: ${blockedStep.notes ?? 'no details'}. Re-analyze and create a revised plan.`,
            { deliverAs: 'followUp' },
          );
          return;
        } else if (choice === 'Abort execution') {
          await exitPlanMode(ctx);
          return;
        }
      }

      // Check if all steps are resolved (done or skipped)
      const allResolved = plan.steps.every((s) => s.status === 'done' || s.status === 'skipped');
      if (allResolved) {
        if (planDir) {
          const planName = planDir.replace(/^\.plans\//, '');
          await updatePlansManifest(planName, 'done', plan.title);
          await savePlanToDisk();
        }

        const list = plan.steps
          .map((s) => {
            if (s.status === 'done') return `~~${s.description}~~`;
            if (s.status === 'skipped') return `⊘ ~~${s.description}~~`;
            return s.description;
          })
          .join('\n');

        pi.sendMessage(
          {
            customType: 'plan-complete',
            content: `**Plan Complete!** ✓\n\n${list}`,
            display: true,
          },
          { triggerTurn: false },
        );

        executing = false;
        plan = undefined;
        planDir = undefined;
        executionStartIdx = undefined;
        pi.setActiveTools(EXEC_TOOLS);
        if (previousModel) {
          await switchModel(ctx, previousModel);
        }
        if (previousThinking) {
          pi.setThinkingLevel(previousThinking);
        }
        updateUI(ctx);
        persist();
        return;
      }
      return;
    }

    if (!planEnabled || !ctx.hasUI) return;
    if (!planDir || !plan) return;

    // Show menu after plan submission
    const choice = await ctx.ui.select('Plan ready — what next?', [
      'Execute Plan',
      'Refine Plan',
      'Follow up',
      'Exit plan mode',
    ]);

    if (choice === 'Execute Plan') {
      await startExecution(ctx);
      updateUI(ctx);

      // Build execution prompt from structured plan data
      const stepList = plan.steps
        .map((s, i) => `${i + 1}. ${s.description}`)
        .join('\n');

      pi.sendUserMessage(
        `Execute the following plan: "${plan.title}"\n\nSteps:\n${stepList}\n\nStart with step 1. Call update_step after completing each step.`,
        { deliverAs: 'followUp' },
      );
    } else if (choice === 'Refine Plan') {
      pi.sendUserMessage(
        `Review the plan you just created with an adversarial lens. Challenge assumptions, find gaps, identify risks, and look for:

- Missing edge cases or error handling
- Incorrect assumptions about the codebase
- Steps that are too vague or could be misinterpreted
- Missing dependencies between steps
- Simpler alternatives that were overlooked

After your review, call submit_plan again with the improved plan.`,
        { deliverAs: 'followUp' },
      );
    } else if (choice === 'Follow up') {
      const followUp = await ctx.ui.editor('Follow-up instructions for the planner:', '');
      if (followUp?.trim()) {
        pi.sendUserMessage(followUp.trim(), { deliverAs: 'followUp' });
      }
    } else if (choice === 'Exit plan mode') {
      await exitPlanMode(ctx);
    }
  });

  // ── Restore state on session start/resume ─────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
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
      plan = saved.data.plan ?? plan;
      executionStartIdx = saved.data.executionStartIdx ?? executionStartIdx;
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
