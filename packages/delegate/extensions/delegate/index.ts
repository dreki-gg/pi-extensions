import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { getAgentDir } from '@mariozechner/pi-coding-agent';
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

const extensionDir = dirname(fileURLToPath(import.meta.url));
const bundledAgentsDir = join(extensionDir, '..', '..', 'agents');

async function bootstrapAgents() {
  const targetDir = join(getAgentDir(), 'agents');
  await mkdir(targetDir, { recursive: true });

  if (!existsSync(bundledAgentsDir)) return;

  let files: string[];
  try {
    files = (await readdir(bundledAgentsDir)).filter((f: string) => f.endsWith('.md'));
  } catch {
    return;
  }

  for (const file of files) {
    const target = join(targetDir, file);
    if (!existsSync(target)) {
      await copyFile(join(bundledAgentsDir, file), target);
    }
  }
}

export default function delegateExtension(pi: ExtensionAPI) {
  pi.on('session_start', async (_event, _ctx) => {
    await bootstrapAgents();
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
