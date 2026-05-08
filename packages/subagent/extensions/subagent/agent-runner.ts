import type { ResolvedPaths } from '@earendil-works/pi-coding-agent';
import { discoverAgents, type AgentScope } from './agents.js';
import type { AgentResult } from './agent-runner-types.js';
import { emptyUsage, spawnPiAgent } from './spawn-utils.js';

export type OnPhaseUpdate = (phaseName: string, agentName: string, result: AgentResult) => void;

export interface RunAgentOptions {
  agentScope?: AgentScope;
  cwd?: string;
  model?: string;
  thinking?: string;
  onUpdate?: OnPhaseUpdate;
  phaseName?: string;
  signal?: AbortSignal;
  resolvedPaths?: ResolvedPaths;
}

export async function runAgent(
  cwd: string,
  agentName: string,
  task: string,
  options: RunAgentOptions = {},
): Promise<AgentResult> {
  const { agents } = discoverAgents(cwd, options.agentScope ?? 'user', options.resolvedPaths);
  const agent = agents.find((a) => a.name === agentName);

  if (!agent) {
    const available = agents.map((a) => a.name).join(', ') || 'none';
    return {
      agent: agentName,
      task,
      exitCode: 1,
      messages: [],
      stderr: `Unknown agent: "${agentName}". Available: ${available}.`,
      usage: emptyUsage(),
    };
  }

  const selectedModel = options.model ?? agent.model;
  const selectedThinking = options.thinking ?? agent.thinking;

  const result: AgentResult = {
    agent: agentName,
    task,
    exitCode: 0,
    messages: [],
    stderr: '',
    usage: emptyUsage(),
    model: selectedModel,
  };

  const spawnResult = await spawnPiAgent({
    cwd: options.cwd ?? cwd,
    agentName: agent.name,
    task,
    systemPrompt: agent.systemPrompt,
    model: selectedModel,
    thinking: selectedThinking,
    tools: agent.tools,
    signal: options.signal,
    onMessage: () => {
      // Copy accumulated state for the phase update callback
      if (options.onUpdate) {
        result.messages = spawnResult.messages;
        result.usage = spawnResult.usage;
        result.model = spawnResult.model ?? result.model;
        result.stopReason = spawnResult.stopReason;
        result.errorMessage = spawnResult.errorMessage;
        options.onUpdate(options.phaseName ?? 'unknown', agentName, { ...result });
      }
    },
    onToolResult: () => {
      if (options.onUpdate) {
        result.messages = spawnResult.messages;
        options.onUpdate(options.phaseName ?? 'unknown', agentName, { ...result });
      }
    },
  });

  result.exitCode = spawnResult.exitCode;
  result.messages = spawnResult.messages;
  result.stderr = spawnResult.stderr;
  result.usage = spawnResult.usage;
  result.model = spawnResult.model ?? result.model;
  result.stopReason = spawnResult.stopReason;
  result.errorMessage = spawnResult.errorMessage;

  return result;
}
