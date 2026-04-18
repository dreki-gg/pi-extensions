import type { AgentScope } from './agents';
import type { WorkflowId } from './delegate-types';

export interface DelegateCommandOptions {
  agentScope: AgentScope;
  workflowId?: WorkflowId;
  confirmProjectAgents: boolean;
  explicitTask?: string;
}

const WORKFLOW_IDS = new Set<WorkflowId>([
  'scout-only',
  'scout-and-plan',
  'implement',
  'implement-and-review',
  'quick-fix',
  'review',
]);

function tokenize(input: string): string[] {
  return input.match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? [];
}

export function formatDelegateUsage(): string {
  return [
    'Usage: /delegate [--scope user|project|both] [--workflow <id>] [--yes-project-agents] [task]',
    '',
    'Workflows: scout-only, scout-and-plan, implement, implement-and-review, quick-fix, review',
  ].join('\n');
}

export function parseDelegateArgs(rawArgs?: string):
  | { ok: true; options: DelegateCommandOptions }
  | { ok: false; error: string } {
  const tokens = tokenize(rawArgs?.trim() ?? '');
  const taskTokens: string[] = [];

  let agentScope: AgentScope = 'user';
  let workflowId: WorkflowId | undefined;
  let confirmProjectAgents = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '--scope') {
      const value = tokens[++i];
      if (!value || !['user', 'project', 'both'].includes(value)) {
        return { ok: false, error: `Invalid --scope value.\n\n${formatDelegateUsage()}` };
      }
      agentScope = value as AgentScope;
      continue;
    }

    if (token === '--workflow') {
      const value = tokens[++i] as WorkflowId | undefined;
      if (!value || !WORKFLOW_IDS.has(value)) {
        return { ok: false, error: `Invalid --workflow value.\n\n${formatDelegateUsage()}` };
      }
      workflowId = value;
      continue;
    }

    if (token === '--yes-project-agents') {
      confirmProjectAgents = false;
      continue;
    }

    if (token.startsWith('--')) {
      return { ok: false, error: `Unknown option: ${token}\n\n${formatDelegateUsage()}` };
    }

    taskTokens.push(token);
  }

  return {
    ok: true,
    options: {
      agentScope,
      workflowId,
      confirmProjectAgents,
      explicitTask: taskTokens.join(' ').trim() || undefined,
    },
  };
}
