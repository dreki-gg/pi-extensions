import type { AgentScope } from './agents';

export interface RunAgentCommandOptions {
  agentScope: AgentScope;
  confirmProjectAgents: boolean;
  model?: string;
  thinking?: string;
  agentName?: string;
  explicitTask?: string;
}

function tokenize(input: string): string[] {
  return input.match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? [];
}

export function formatRunAgentUsage(): string {
  return 'Usage: /run-agent [--scope user|project|both] [--model <id>] [--thinking <level>] [--yes-project-agents] <agent> [task]';
}

export function parseRunAgentArgs(rawArgs?: string):
  | { ok: true; options: RunAgentCommandOptions }
  | { ok: false; error: string } {
  const tokens = tokenize(rawArgs?.trim() ?? '');
  const taskTokens: string[] = [];

  let agentScope: AgentScope = 'user';
  let confirmProjectAgents = true;
  let model: string | undefined;
  let thinking: string | undefined;
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

    if (token === '--model') {
      const value = tokens[++i];
      if (!value) {
        return { ok: false, error: `Missing --model value.\n\n${formatRunAgentUsage()}` };
      }
      model = value;
      continue;
    }

    if (token === '--thinking' || token === '--reasoning-level') {
      const value = tokens[++i];
      if (!value) {
        return { ok: false, error: `Missing ${token} value.\n\n${formatRunAgentUsage()}` };
      }
      thinking = value;
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
      model,
      thinking,
      agentName,
      explicitTask: taskTokens.join(' ').trim() || undefined,
    },
  };
}
