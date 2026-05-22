import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { getConfigPath } from '../config';

export function registerReviewInitCommand(pi: ExtensionAPI) {
  pi.registerCommand('review-init', {
    description: 'Scaffold a .code-review/ directory with default lenses for this project',
    handler: async (_args, ctx) => {
      const configPath = getConfigPath(ctx.cwd);
      pi.sendUserMessage(
        [
          `Initialize a code review configuration for this project.`,
          ``,
          `1. Read the project's AGENTS.md, package.json, and any CONTEXT.md to understand the stack and conventions.`,
          `2. Create a \`.code-review.json\` config file at the project root.`,
          `3. Create lens files in \`.code-review/lenses/\` — start with: code-quality.md, maintainability.md`,
          `4. Each lens should reference the project's actual tools (from package.json scripts).`,
          `5. Tailor the criteria to the project's stack and conventions.`,
          ``,
          `Config path: ${configPath}`,
        ].join('\n'),
        { deliverAs: 'followUp' },
      );
    },
  });
}
