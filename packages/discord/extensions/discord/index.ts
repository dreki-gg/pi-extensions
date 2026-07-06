import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type DiscordProjectConfig, getCredentials, loadProjectConfig } from './config.js';
import { listChannels, readMessages } from './client/channels.js';
import { downloadAttachment } from './client/attachments.js';
import { formatChannelList, formatMessages, formatDownloadedAttachment } from './format.js';
import {
  TOOL_GUIDELINES,
  listChannelsParams,
  readMessagesParams,
  downloadAttachmentParams,
} from './tools.js';
import { errorResult, missingCredentials, runDiscord, textResult } from './runtime.js';
import { registerStatusCommand } from './command.js';

export default function discordExtension(pi: ExtensionAPI) {
  let projectConfig: DiscordProjectConfig | null = null;

  pi.on('session_start', async (_event, ctx) => {
    try {
      projectConfig = await loadProjectConfig(ctx.cwd);
    } catch (err) {
      ctx.ui.notify(`Discord config error: ${(err as Error).message}`, 'warning');
      projectConfig = null;
    }
  });

  // -------------------------------------------------------------------------
  // discord_list_channels
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'discord_list_channels',
    label: 'Discord List Channels',
    description:
      'List text channels in a Discord server (guild) the bot has access to. Provide a guild ID or set defaultGuild in .pi/discord.json.',
    promptSnippet: 'List Discord channels in a server',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: listChannelsParams,

    async execute(_toolCallId: string, params: { guild?: string }) {
      const creds = getCredentials();
      if (!creds) return missingCredentials();

      const guild = params.guild ?? projectConfig?.defaultGuild;
      if (!guild) {
        return errorResult(
          '❌ No guild specified. Pass `guild` or set "defaultGuild" in .pi/discord.json.',
        );
      }

      try {
        const result = await runDiscord(creds, listChannels({ guild }));
        return textResult(formatChannelList(result.channels, guild), {
          count: result.channels.length,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // discord_read_messages
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'discord_read_messages',
    label: 'Discord Read Messages',
    description:
      'Read message history from a Discord channel. Returns messages with author, timestamp, reactions, and attachment URLs. Oldest-first; page back with `before`.',
    promptSnippet: 'Read messages from a Discord channel',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: readMessagesParams,

    async execute(
      _toolCallId: string,
      params: { channel: string; limit?: number; before?: string; after?: string },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials();

      const limit = params.limit ?? projectConfig?.messageLimit ?? 50;

      try {
        const result = await runDiscord(creds, readMessages({ ...params, limit }));
        const ids = result.messages.map((m) => m.id);
        return textResult(formatMessages(result, params.channel), {
          count: result.messages.length,
          // Discord returns newest-first: first element is newest, last is oldest.
          newestId: ids[0],
          oldestId: ids[ids.length - 1],
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // discord_download_attachment
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'discord_download_attachment',
    label: 'Discord Download Attachment',
    description:
      'Download an attachment (image or file) shared in a Discord message. Saves to a temp directory and returns the local path. Use `read` to view downloaded images.',
    promptSnippet: 'Download a Discord attachment to a local temp path',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: downloadAttachmentParams,

    async execute(_toolCallId: string, params: { url: string }) {
      const creds = getCredentials();
      if (!creds) return missingCredentials();

      try {
        const result = await runDiscord(creds, downloadAttachment(params.url));
        return textResult(formatDownloadedAttachment(result), {
          localPath: result.localPath,
          filename: result.filename,
          isImage: result.isImage,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // /discord command — status check
  // -------------------------------------------------------------------------

  registerStatusCommand(pi, () => projectConfig);
}
