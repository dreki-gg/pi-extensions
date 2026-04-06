import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ExtensionAPI, ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { getAgentDir } from '@mariozechner/pi-coding-agent';

/** Well-known symbol shared with @dreki-gg/pi-subagent for agent dir registration */
const PI_AGENT_DIRS = Symbol.for('pi.agentDirs');
import { runAgent, runParallel } from './executor';
import { buildSynthesisPrompt, extractRecentConversation } from './synthesis';
import type { AgentResult, DelegateState, PhaseDefinition, PhaseResult, UsageStats } from './types';
import {
  aggregateUsage,
  confirmPlan,
  confirmSynthesis,
  formatFullSummary,
  formatPhaseHeader,
  getFinalText,
  pickWorkflow,
} from './ui';

function emptyUsage(): UsageStats {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

function combineParallelOutputs(results: AgentResult[]): string {
  return results
    .map((r) => {
      const output = getFinalText(r);
      return `## ${r.agent}\n${output}`;
    })
    .join('\n\n');
}

async function executePhase(
  cwd: string,
  phase: PhaseDefinition,
  synthesis: string,
  previousOutput: string,
  ctx: ExtensionCommandContext,
): Promise<{ results: AgentResult[]; output: string; aborted: boolean }> {
  const task = phase.taskTemplate
    .replace(/\{synthesis\}/g, synthesis)
    .replace(/\{previous\}/g, previousOutput);

  ctx.ui.notify(
    `${formatPhaseHeader(phase.name, 'running')} ${phase.kind === 'parallel' ? `(${phase.agents.length} agents)` : phase.agents[0]}`,
    'info',
  );

  let results: AgentResult[];
  if (phase.kind === 'parallel') {
    results = await runParallel(
      cwd,
      phase.agents,
      task,
      (_phaseName, _agentName, _result) => {
        // Streaming updates happen per-message
      },
      phase.name,
    );
  } else {
    const result = await runAgent(cwd, phase.agents[0], task, undefined, phase.name);
    results = [result];
  }

  const hasError = results.some((r) => r.exitCode !== 0 || r.stopReason === 'error');
  if (hasError) {
    const failedAgents = results
      .filter((r) => r.exitCode !== 0 || r.stopReason === 'error')
      .map((r) => `${r.agent}: ${r.errorMessage || r.stderr || '(unknown error)'}`)
      .join('\n');

    ctx.ui.notify(`${formatPhaseHeader(phase.name, 'failed')}\n${failedAgents}`, 'error');
    return { results, output: combineParallelOutputs(results), aborted: true };
  }

  const output = combineParallelOutputs(results);
  ctx.ui.notify(formatPhaseHeader(phase.name, 'done'), 'info');

  if (phase.requiresConfirmation) {
    const planText = output;
    const proceed = await confirmPlan(ctx, planText);
    if (!proceed) {
      ctx.ui.notify('Delegate aborted by user after plan review.', 'warning');
      return { results, output, aborted: true };
    }
  }

  return { results, output, aborted: false };
}

const bundledAgentsDir = resolve(import.meta.dirname, '..', '..', 'agents');

/** Register bundled agents dir so the subagent tool can discover them */
function registerBundledAgents(): void {
  const g = globalThis as any;
  if (!g[PI_AGENT_DIRS]) g[PI_AGENT_DIRS] = [];
  if (!g[PI_AGENT_DIRS].some((e: { dir: string }) => e.dir === bundledAgentsDir)) {
    g[PI_AGENT_DIRS].push({ dir: bundledAgentsDir, source: 'project' });
  }
}

async function listMdFiles(dir: string): Promise<Set<string>> {
  if (!existsSync(dir)) return new Set();
  try {
    const entries = await readdir(dir);
    return new Set(entries.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')));
  } catch {
    return new Set();
  }
}

export default function delegateExtension(pi: ExtensionAPI) {
  registerBundledAgents();

  pi.registerCommand('delegate-agents', {
    description: 'List, customize, or reset delegate agents',
    handler: async (args, ctx) => {
      const userDir = join(getAgentDir(), 'agents');
      const parts = args?.trim().split(/\s+/) || [];
      const action = parts[0] || 'list';

      if (action === 'list') {
        const bundled = await listMdFiles(bundledAgentsDir);
        const user = await listMdFiles(userDir);
        const allNames = new Set([...bundled, ...user]);

        const lines: string[] = ['## Delegate Agents\n'];
        for (const name of [...allNames].sort()) {
          const isBundled = bundled.has(name);
          const isUser = user.has(name);
          if (isUser && isBundled) {
            lines.push(`- **${name}** — user override (bundled version available, \`/delegate-agents reset ${name}\` to restore)`);
          } else if (isUser) {
            lines.push(`- **${name}** — user-only`);
          } else {
            lines.push(`- **${name}** — bundled`);
          }
        }
        pi.sendMessage({ customType: 'delegate-agents-list', content: lines.join('\n'), display: true });
        return;
      }

      if (action === 'reset') {
        const name = parts[1];
        if (!name) {
          ctx.ui.notify('Usage: /delegate-agents reset <name|--all>', 'warning');
          return;
        }

        if (name === '--all') {
          const user = await listMdFiles(userDir);
          const bundled = await listMdFiles(bundledAgentsDir);
          let count = 0;
          for (const n of user) {
            if (bundled.has(n)) {
              await unlink(join(userDir, `${n}.md`));
              count++;
            }
          }
          ctx.ui.notify(count > 0 ? `Reset ${count} agent(s) to bundled versions.` : 'No user overrides to reset.', 'info');
          return;
        }

        const userFile = join(userDir, `${name}.md`);
        const bundledFile = join(bundledAgentsDir, `${name}.md`);

        if (!existsSync(userFile)) {
          ctx.ui.notify(`No user override for "${name}" — already using bundled version.`, 'info');
          return;
        }
        if (!existsSync(bundledFile)) {
          ctx.ui.notify(`"${name}" is user-only (no bundled version). Delete manually if needed.`, 'warning');
          return;
        }

        await unlink(userFile);
        ctx.ui.notify(`Reset "${name}" — now using bundled version.`, 'info');
        return;
      }

      if (action === 'edit') {
        const name = parts[1];
        if (!name) {
          ctx.ui.notify('Usage: /delegate-agents edit <name>', 'warning');
          return;
        }

        const bundledFile = join(bundledAgentsDir, `${name}.md`);
        const userFile = join(userDir, `${name}.md`);

        if (existsSync(userFile)) {
          ctx.ui.notify(`User override already exists: ${userFile}`, 'info');
          return;
        }
        if (!existsSync(bundledFile)) {
          ctx.ui.notify(`No bundled agent named "${name}".`, 'warning');
          return;
        }

        await mkdir(userDir, { recursive: true });
        await copyFile(bundledFile, userFile);
        ctx.ui.notify(`Copied "${name}" to ${userFile} — edit it there to customize.`, 'info');
        return;
      }

      ctx.ui.notify('Unknown action. Usage: /delegate-agents [list|reset <name|--all>|edit <name>]', 'warning');
    },
  });

  pi.registerCommand('delegate', {
    description: 'Orchestrate subagent workflows — scouts, planners, workers, reviewers',
    handler: async (args, ctx) => {
      const explicitTask = args?.trim() || undefined;

      // Step 1: Synthesize
      const conversation = extractRecentConversation(ctx);
      if (!conversation.trim() && !explicitTask) {
        ctx.ui.notify(
          'No conversation context and no task specified. Usage: /delegate [task]',
          'warning',
        );
        return;
      }

      const prompt = buildSynthesisPrompt(conversation, explicitTask);
      ctx.ui.notify('⏳ Synthesizing task from conversation...', 'info');

      const synthResult = await runAgent(ctx.cwd, 'planner', prompt);
      const synthesis = getFinalText(synthResult);

      if (!synthesis.trim()) {
        ctx.ui.notify('Failed to synthesize task from conversation.', 'error');
        return;
      }

      // Step 2: Confirm synthesis
      const synthOk = await confirmSynthesis(ctx, synthesis);
      if (!synthOk) {
        ctx.ui.notify('Delegate cancelled.', 'info');
        return;
      }

      // Step 3: Pick workflow
      const workflow = await pickWorkflow(ctx, synthesis);
      if (!workflow) {
        ctx.ui.notify('Delegate cancelled — no workflow selected.', 'info');
        return;
      }

      // Step 4: Execute phases
      const state: DelegateState = {
        synthesis,
        workflow,
        phases: [],
        totalUsage: emptyUsage(),
      };

      let previousOutput = '';

      ctx.ui.notify(`Starting workflow: ${workflow.label}`, 'info');

      for (const phaseDef of workflow.phases) {
        const phaseResult = await executePhase(ctx.cwd, phaseDef, synthesis, previousOutput, ctx);

        const phase: PhaseResult = {
          name: phaseDef.name,
          kind: phaseDef.kind,
          agents: phaseResult.results,
        };

        state.phases.push(phase);
        const phaseUsage = aggregateUsage(phaseResult.results);
        state.totalUsage.input += phaseUsage.input;
        state.totalUsage.output += phaseUsage.output;
        state.totalUsage.cacheRead += phaseUsage.cacheRead;
        state.totalUsage.cacheWrite += phaseUsage.cacheWrite;
        state.totalUsage.cost += phaseUsage.cost;
        state.totalUsage.turns += phaseUsage.turns;

        if (phaseResult.aborted) break;

        previousOutput = phaseResult.output;
      }

      // Step 5: Show full summary
      const summary = formatFullSummary(state);
      ctx.ui.notify(`Delegate complete — ${workflow.label}`, 'info');

      // Send the summary as a message so it appears in the conversation
      pi.sendMessage({
        customType: 'delegate-summary',
        content: summary,
        display: true,
        details: {
          workflow: workflow.id,
          phaseCount: state.phases.length,
          totalUsage: state.totalUsage,
        },
      });
    },
  });
}
