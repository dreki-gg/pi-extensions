import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  type DiscordProjectConfig,
  getCredentialStatus,
  loadProjectConfig,
} from './config.js';

interface CommandContext {
  cwd: string;
  hasUI: boolean;
  ui: { notify(message: string, level: 'info' | 'warning' | 'error'): void };
}

/**
 * Registers the `/discord` status command. `getConfig` returns the
 * session's loaded project config (or null before session_start ran).
 */
export function registerStatusCommand(
  pi: ExtensionAPI,
  getConfig: () => DiscordProjectConfig | null,
) {
  pi.registerCommand('discord', {
    description: 'Show Discord extension configuration and connection status',
    handler: async (_args: string, ctx: CommandContext) => {
      const credStatus = getCredentialStatus();
      const config = getConfig() ?? (await loadProjectConfig(ctx.cwd).catch(() => null));

      const lines: string[] = ['Discord Extension Status', ''];
      lines.push(
        `Bot Token: ${credStatus.hasBotToken ? '✅ Set' : '❌ Missing (DISCORD_BOT_TOKEN)'}`,
      );
      lines.push('');

      if (config) {
        lines.push('Project Config (.pi/discord.json):');
        lines.push(`  Default guild: ${config.defaultGuild ?? '(not set)'}`);
        lines.push(`  Default channel: ${config.defaultChannel ?? '(not set)'}`);
        lines.push(`  Message limit: ${config.messageLimit}`);
      } else {
        lines.push('No .pi/discord.json found — using defaults.');
      }

      if (ctx.hasUI) {
        ctx.ui.notify(lines.join('\n'), 'info');
      }
    },
  });
}
