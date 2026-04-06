import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import type {
  AgentResult,
  DelegateState,
  PhaseResult,
  UsageStats,
  WorkflowDefinition,
} from './delegate-types';
import { WORKFLOWS, suggestWorkflow } from './workflows';

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsage(usage: UsageStats): string {
  const parts: string[] = [];
  if (usage.turns) parts.push(`${usage.turns} turns`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  return parts.join(' ');
}

function getFinalText(result: AgentResult): string {
  for (let i = result.messages.length - 1; i >= 0; i--) {
    const msg = result.messages[i];
    if (msg.role === 'assistant') {
      for (const part of msg.content) {
        if (part.type === 'text') return part.text;
      }
    }
  }
  return '(no output)';
}

export async function confirmSynthesis(
  ctx: ExtensionCommandContext,
  synthesis: string,
): Promise<boolean> {
  return ctx.ui.confirm('Delegate — Task Synthesis', `${synthesis}\n\nProceed with this task?`);
}

export async function pickWorkflow(
  ctx: ExtensionCommandContext,
  synthesis: string,
): Promise<WorkflowDefinition | null> {
  const suggested = suggestWorkflow(synthesis);
  const options = WORKFLOWS.map((wf) => {
    const marker = wf.id === suggested ? ' ← suggested' : '';
    return `${wf.label}${marker} — ${wf.description}`;
  });

  const choice = await ctx.ui.select('Delegate — Choose Workflow', options);
  if (choice === undefined || choice === null) return null;

  const selectedIndex = options.indexOf(choice as string);
  if (selectedIndex < 0) return null;

  return WORKFLOWS[selectedIndex];
}

export async function confirmPlan(
  ctx: ExtensionCommandContext,
  planText: string,
): Promise<boolean> {
  return ctx.ui.confirm('Delegate — Review Plan', `${planText}\n\nContinue with implementation?`);
}

export function formatPhaseHeader(
  phaseName: string,
  status: 'running' | 'done' | 'failed' | 'skipped',
): string {
  const icons = { running: '⏳', done: '✓', failed: '✗', skipped: '⊘' };
  return `${icons[status]} ${phaseName}`;
}

export function formatAgentResult(result: AgentResult): string {
  const icon = result.exitCode === 0 ? '✓' : '✗';
  const output = getFinalText(result);
  const preview = output.length > 200 ? `${output.slice(0, 200)}...` : output;
  const usage = formatUsage(result.usage);
  const model = result.model ? ` [${result.model}]` : '';

  return `${icon} ${result.agent}${model}\n${preview}\n${usage}`;
}

export function formatPhaseSummary(phase: PhaseResult): string {
  if (phase.skipped) return `⊘ ${phase.name} — skipped`;

  const header = `── ${phase.name} (${phase.kind}) ──`;
  const agentSummaries = phase.agents.map(formatAgentResult).join('\n\n');
  return `${header}\n${agentSummaries}`;
}

export function formatFullSummary(state: DelegateState): string {
  const sections = [
    `── Synthesis ──\n${state.synthesis}`,
    `── Workflow: ${state.workflow.label} ──`,
    ...state.phases.map(formatPhaseSummary),
    `── Usage ──\nTotal: ${formatUsage(state.totalUsage)}`,
  ];

  return sections.join('\n\n');
}

export function aggregateUsage(results: AgentResult[]): UsageStats {
  const total: UsageStats = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    contextTokens: 0,
    turns: 0,
  };
  for (const r of results) {
    total.input += r.usage.input;
    total.output += r.usage.output;
    total.cacheRead += r.usage.cacheRead;
    total.cacheWrite += r.usage.cacheWrite;
    total.cost += r.usage.cost;
    total.turns += r.usage.turns;
  }
  return total;
}

export { getFinalText };
