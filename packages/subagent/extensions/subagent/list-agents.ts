/**
 * list_agents tool — lets the LLM discover available agents before spawning.
 */

import type { ExtensionAPI, ResolvedPaths } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { type AgentScope, discoverAgents } from './agents.js';
import { StringEnum } from '@earendil-works/pi-ai';

export function registerListAgentsTool(
  pi: ExtensionAPI,
  resolvePackagePaths: (cwd: string) => Promise<ResolvedPaths | undefined>,
) {
  const AgentScopeSchema = StringEnum(['user', 'project', 'both'] as const, {
    description:
      'Which agent directories to search. Default: "user". Use "both" to include project-local agents.',
    default: 'user',
  });

  pi.registerTool({
    name: 'list_agents',
    label: 'List Agents',
    description:
      'List available subagent prompts. Call this before spawning agents if you are unsure which agents exist.',
    promptSnippet: 'List available subagent prompts to discover what agents can be spawned',
    promptGuidelines: [
      'Call list_agents before using the subagent tool when you are not certain which agents are available.',
      'list_agents returns agent names, descriptions, sources, and capabilities.',
    ],
    parameters: Type.Object({
      agentScope: Type.Optional(AgentScopeSchema),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const agentScope: AgentScope = params.agentScope ?? 'user';
      const resolvedPaths = await resolvePackagePaths(ctx.cwd);
      const discovery = discoverAgents(ctx.cwd, agentScope, resolvedPaths);

      if (discovery.agents.length === 0) {
        const dirs =
          agentScope === 'user'
            ? '~/.pi/agent/prompts'
            : agentScope === 'project'
              ? '.pi/prompts'
              : '~/.pi/agent/prompts and .pi/prompts';
        return {
          content: [
            {
              type: 'text',
              text: `No agents found in scope "${agentScope}". Check ${dirs} for agent prompt files.`,
            },
          ],
          details: { agents: [], scope: agentScope },
        };
      }

      const lines: string[] = [`Available agents (scope: ${agentScope}):`, ''];

      for (const agent of discovery.agents) {
        lines.push(`### ${agent.name}`);
        lines.push(`- **Source**: ${agent.source}`);
        lines.push(`- **Description**: ${agent.description}`);
        if (agent.model) lines.push(`- **Default model**: ${agent.model}`);
        if (agent.thinking) lines.push(`- **Default thinking**: ${agent.thinking}`);
        if (agent.tools) lines.push(`- **Tools**: ${agent.tools.join(', ')}`);
        if (agent.sessionStrategy) lines.push(`- **Session strategy**: ${agent.sessionStrategy}`);
        lines.push('');
      }

      if (discovery.projectPromptsDir) {
        lines.push(`Project prompts directory: ${discovery.projectPromptsDir}`);
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: {
          agents: discovery.agents.map((a) => ({
            name: a.name,
            description: a.description,
            source: a.source,
            model: a.model,
            tools: a.tools,
          })),
          scope: agentScope,
          projectPromptsDir: discovery.projectPromptsDir,
        },
      };
    },
  });
}
