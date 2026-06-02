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
          `2. Create a \`.code-review.json\` config file at the project root. Supported keys:`,
          `   - \`lensDir\` (default \`.code-review/lenses\`), \`defaultLenses\` (lenses run when none are specified),`,
          `   - \`toolTimeoutMs\` (per-tool timeout, default 60000), \`toolConcurrency\` (parallel tools, default 4),`,
          `   - \`review\` (self-driving pipeline): \`passes\` (default 5, 0 disables), \`validate\` (default true),`,
          `     \`minVotes\` (default 2), \`concurrency\` (default = passes), \`temperature\` (default 0.4), \`maxFindings\` (default 50),`,
          `     and per-step models for a bake-off: \`passModel\`, \`passModels\` (rotated across passes), \`validateModel\``,
          `     (each a "provider/id", bare id, or display name; default = the session model).`,
          `3. Create lens files in \`.code-review/lenses/\` — start with: code-quality.md, maintainability.md`,
          `4. Each lens's \`## Tools\` must list ONLY fast, non-side-effecting commands that EXIT on their own`,
          `   (e.g. typecheck, lint, unit tests). Do NOT list dev servers, watch mode, e2e suites, or full`,
          `   production builds — they bind ports / run for minutes and belong in CI. Tools are deduped across`,
          `   lenses and run concurrently, so a slow or hanging command stalls the whole review.`,
          `5. Tailor the criteria to the project's stack and conventions; prefer concrete, pattern-matched checks`,
          `   (name the project's real failure modes + the diff "smells" to look for) over generic virtues.`,
          ``,
          `Config path: ${configPath}`,
        ].join('\n'),
        { deliverAs: 'followUp' },
      );
    },
  });
}
