import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { loadConfig, getLensDir } from '../config';
import { collectDiff } from '../diff';
import { discoverLenses, getLensContent } from '../lenses';
import { reviewWithLens } from '../reviewer';
import { parseReviewArgs } from '../parse-args';

export function registerReviewCommand(pi: ExtensionAPI) {
  pi.registerCommand('review', {
    description:
      'Run a multi-lens code review on working directory changes. Usage: /review [--lens name,...] [--base ref] [--staged]',
    handler: async (args, ctx) => {
      const cwd = ctx.cwd;
      const config = loadConfig(cwd);
      const lensDir = getLensDir(cwd, config);
      const available = discoverLenses(lensDir);

      if (available.size === 0) {
        ctx.ui.notify(
          `No lenses found in ${config.lensDir}. Run /review-init to scaffold a default config.`,
          'warning',
        );
        return;
      }

      const parsed = parseReviewArgs(args ?? '');
      const lensNames = resolveLensNames(parsed.lenses, config.defaultLenses, available, (msg) =>
        ctx.ui.notify(msg, 'warning'),
      );

      if (lensNames.length === 0) {
        ctx.ui.notify('No lenses selected', 'warning');
        return;
      }

      const diff = await collectDiff(pi, cwd, {
        base: parsed.base,
        staged: parsed.staged,
      });

      if (!diff.diff.trim()) {
        ctx.ui.notify('No changes to review', 'info');
        return;
      }

      ctx.ui.notify(`Reviewing ${diff.label} through ${lensNames.length} lens(es)...`, 'info');

      const lensPrompts: string[] = [];
      for (const name of lensNames) {
        const lens = available.get(name)!;
        const content = getLensContent(lensDir, name) ?? '';
        const result = await reviewWithLens(pi, ctx, cwd, lens, content, diff);

        if (result._prompt) {
          lensPrompts.push(result._prompt);
        }
      }

      const combinedPrompt = [
        `Review the following changes through ${lensNames.length} lens(es): ${lensNames.join(', ')}.`,
        '',
        'For each lens, evaluate the diff against its criteria and produce findings.',
        'Output your review as a structured report with sections per lens.',
        '',
        ...lensPrompts,
      ].join('\n');

      pi.sendUserMessage(combinedPrompt, { deliverAs: 'followUp' });
    },
  });
}

/** Resolve which lens names to run based on explicit selection, defaults, or all available. */
function resolveLensNames(
  requested: string[],
  defaults: string[],
  available: Map<string, unknown>,
  warn: (msg: string) => void,
): string[] {
  if (requested.length > 0) {
    const missing = requested.filter((l) => !available.has(l));
    if (missing.length > 0) warn(`Unknown lenses: ${missing.join(', ')}`);
    return requested.filter((l) => available.has(l));
  }

  if (defaults.length > 0) {
    return defaults.filter((l) => available.has(l));
  }

  return [...available.keys()];
}
