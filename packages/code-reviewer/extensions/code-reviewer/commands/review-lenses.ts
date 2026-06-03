import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { loadConfig, getLensDir } from '../config';
import { discoverLenses } from '../lenses';

export function registerReviewLensesCommand(pi: ExtensionAPI) {
  pi.registerCommand('review-lenses', {
    description: 'List available review lenses for this project',
    handler: async (_args, ctx) => {
      const config = await loadConfig(ctx.cwd);
      const lensDir = getLensDir(ctx.cwd, config);
      const available = await discoverLenses(lensDir);

      if (available.size === 0) {
        ctx.ui.notify(
          `No lenses in ${config.lensDir}. Run /review-init to scaffold defaults.`,
          'warning',
        );
        return;
      }

      const lines = [`Available lenses (${config.lensDir}):`, ''];
      for (const [key, lens] of available) {
        const isDefault = config.defaultLenses.includes(key);
        const marker = isDefault ? ' ★' : '';
        const tools = lens.tools.length > 0 ? ` [${lens.tools.length} tool(s)]` : '';
        lines.push(`  ${key}${marker} — ${lens.description}${tools}`);
      }

      if (config.defaultLenses.length > 0) {
        lines.push('');
        lines.push(`★ = default lens (runs when no --lens specified)`);
      }

      ctx.ui.notify(lines.join('\n'), 'info');
    },
  });
}
