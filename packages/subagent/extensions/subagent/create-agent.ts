/**
 * /create-agent command — scaffolds a new project-local agent prompt in .pi/prompts/.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const TEMPLATE = `---
name: {{name}}
description: {{description}}
---

You are the **{{name}}** agent.

## Role

{{description}}

## Guidelines

- Be concise and focused on your assigned task.
- Use available tools to gather context before acting.
- Report your findings or output clearly.
`;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function registerCreateAgentCommand(pi: ExtensionAPI) {
  pi.registerCommand('create-agent', {
    description:
      'Create a new project-local agent prompt in .pi/prompts/. Usage: /create-agent <name> [description]',

    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify(
          'Usage: /create-agent <name> [description]\n\nCreates a new agent prompt file in .pi/prompts/',
          'warning',
        );
        return;
      }

      const tokens = args.trim().split(/\s+/);
      const name = slugify(tokens[0]);
      const description = tokens.slice(1).join(' ') || `A project-local ${name} agent.`;

      if (!name) {
        ctx.ui.notify('Invalid agent name.', 'error');
        return;
      }

      const promptsDir = path.join(ctx.cwd, '.pi', 'prompts');
      const filePath = path.join(promptsDir, `${name}.md`);

      if (fs.existsSync(filePath)) {
        ctx.ui.notify(
          `Agent "${name}" already exists at ${filePath}`,
          'warning',
        );
        return;
      }

      // Create directory if needed
      fs.mkdirSync(promptsDir, { recursive: true });

      // Write the template
      const content = TEMPLATE
        .replace(/\{\{name\}\}/g, name)
        .replace(/\{\{description\}\}/g, description);

      fs.writeFileSync(filePath, content, 'utf-8');

      ctx.ui.notify(
        `Created agent "${name}" at ${path.relative(ctx.cwd, filePath)}`,
        'info',
      );

      // Send a follow-up so the LLM can help refine the prompt
      pi.sendUserMessage(
        [
          `I just created a new project-local agent prompt at \`${path.relative(ctx.cwd, filePath)}\`.`,
          '',
          `Agent name: **${name}**`,
          `Description: ${description}`,
          '',
          'The file has a basic template. You can now read and refine the agent prompt to fit your needs.',
          'Remember to use `agentScope: "both"` or `agentScope: "project"` when spawning this agent.',
        ].join('\n'),
        { deliverAs: 'followUp' },
      );
    },
  });
}
