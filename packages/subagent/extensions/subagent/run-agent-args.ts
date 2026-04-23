import type { AgentScope } from './agents';

export interface RunAgentCommandOptions {
  agentScope: AgentScope;
  confirmProjectAgents: boolean;
  agentName?: string;
  explicitTask?: string;
}

function tokenize(input: string): string[] {
  return input.match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? [];
}

export function formatRunAgentUsage(): string {
  return 'Usage: /run-agent [--scope user|project|both] [--yes-project-agents] <agent> [task]';
}

export function parseRunAgentArgs(rawArgs?: string):
  | { ok: true; options: RunAgentCommandOptions }
  | { ok: false; error: string } {
  const tokens = tokenize(rawArgs?.trim() ?? '');
  const taskTokens: string[] = [];

  let agentScope: AgentScope = 'user';
  let confirmProjectAgents = true;
  let agentName: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '--scope') {
      const value = tokens[++i];
      if (!value || !['user', 'project', 'both'].includes(value)) {
        return { ok: false, error: `Invalid --scope value.\n\n${formatRunAgentUsage()}` };
      }
      agentScope = value as AgentScope;
      continue;
    }

    if (token === '--yes-project-agents') {
      confirmProjectAgents = false;
      continue;
    }

    if (token.startsWith('--')) {
      return { ok: false, error: `Unknown option: ${token}\n\n${formatRunAgentUsage()}` };
    }

    if (!agentName) {
      agentName = token;
      continue;
    }

    taskTokens.push(token);
  }

  return {
    ok: true,
    options: {
      agentScope,
      confirmProjectAgents,
      agentName,
      explicitTask: taskTokens.join(' ').trim() || undefined,
    },
  };
}
