import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Effect } from 'effect';
import type { HttpClient } from '@effect/platform';
import type { SlackConfig } from './client/http.js';
import {
  type SlackProjectConfig,
  type SlackCredentials,
  getCredentials,
  getCredentialStatus,
  loadProjectConfig,
} from './config.js';
import { makeRuntimeLayer } from './client/SlackClient.js';
import { listChannels } from './client/channels.js';
import { readMessages, readThread } from './client/channels.js';
import { searchMessages } from './client/search.js';
import { downloadFile } from './client/files.js';
import { postMessage, editMessage, deleteMessage } from './client/messages.js';
import {
  formatChannelList,
  formatMessages,
  formatThread,
  formatSearchResults,
  formatDownloadedFile,
  formatPostedMessage,
  formatEditedMessage,
  formatDeletedMessage,
} from './format.js';
import {
  TOOL_GUIDELINES,
  listChannelsParams,
  readMessagesParams,
  readThreadParams,
  searchParams,
  downloadFileParams,
  postMessageParams,
  editMessageParams,
  deleteMessageParams,
} from './tools.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: (details ?? {}) as Record<string, unknown>,
  };
}

function errorResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: (details ?? {}) as Record<string, unknown>,
    isError: true,
  };
}

function missingCredentials(which: 'bot' | 'user') {
  const envVar = which === 'bot' ? 'SLACK_BOT_TOKEN' : 'SLACK_USER_TOKEN';
  return errorResult(
    `❌ Missing ${envVar}.\n\nSet this environment variable to enable this Slack tool.`,
    { error: 'missing_credentials', missing: [envVar] },
  );
}

/**
 * Runs an Effect program with the Slack runtime layer.
 * This is the boundary between Effect and plain-TS tool handlers.
 */
type SlackRuntime = SlackConfig | HttpClient.HttpClient;

function runSlack<A, E>(
  credentials: SlackCredentials,
  program: Effect.Effect<A, E, SlackRuntime>,
): Promise<A> {
  const layer = makeRuntimeLayer(credentials);
  return Effect.runPromise(program.pipe(Effect.provide(layer)));
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function slackExtension(pi: ExtensionAPI) {
  let projectConfig: SlackProjectConfig | null = null;

  pi.on('session_start', async (_event, ctx) => {
    try {
      projectConfig = await loadProjectConfig(ctx.cwd);
    } catch (err) {
      ctx.ui.notify(`Slack config error: ${(err as Error).message}`, 'warning');
      projectConfig = null;
    }
  });

  // -------------------------------------------------------------------------
  // slack_list_channels
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_list_channels',
    label: 'Slack List Channels',
    description: 'List Slack channels the bot has access to.',
    promptSnippet: 'List available Slack channels',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: listChannelsParams,

    async execute(
      _toolCallId: string,
      params: { limit?: number; cursor?: string; types?: string },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');

      try {
        const result = await runSlack(creds, listChannels(params));
        return textResult(formatChannelList(result.channels), {
          count: result.channels.length,
          cursor: result.cursor,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // slack_read_messages
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_read_messages',
    label: 'Slack Read Messages',
    description:
      'Read message history from a Slack channel. Returns messages with timestamps, users, reactions, and file attachments.',
    promptSnippet: 'Read messages from a Slack channel',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: readMessagesParams,

    async execute(
      _toolCallId: string,
      params: {
        channel: string;
        limit?: number;
        oldest?: string;
        latest?: string;
        cursor?: string;
      },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');

      const limit = params.limit ?? projectConfig?.messageLimit ?? 50;

      try {
        const result = await runSlack(creds, readMessages({ ...params, limit }));
        return textResult(formatMessages(result, params.channel), {
          count: result.messages.length,
          hasMore: result.hasMore,
          cursor: result.cursor,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // slack_read_thread
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_read_thread',
    label: 'Slack Read Thread',
    description:
      'Read all replies in a Slack thread. Provide the channel ID and the thread parent timestamp.',
    promptSnippet: 'Read replies in a Slack thread',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: readThreadParams,

    async execute(
      _toolCallId: string,
      params: {
        channel: string;
        thread_ts: string;
        limit?: number;
        cursor?: string;
      },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');

      try {
        const result = await runSlack(
          creds,
          readThread({
            channel: params.channel,
            threadTs: params.thread_ts,
            limit: params.limit,
            cursor: params.cursor,
          }),
        );
        return textResult(formatThread(result, params.channel, params.thread_ts), {
          count: result.messages.length,
          hasMore: result.hasMore,
          cursor: result.cursor,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // slack_search
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_search',
    label: 'Slack Search',
    description:
      'Full-text search across Slack messages. Supports Slack search syntax (in:#channel, from:@user, has:link). Requires SLACK_USER_TOKEN.',
    promptSnippet: 'Search Slack messages across the workspace',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: searchParams,

    async execute(
      _toolCallId: string,
      params: {
        query: string;
        count?: number;
        sort?: 'score' | 'timestamp';
        sort_dir?: 'asc' | 'desc';
        cursor?: string;
      },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');
      if (!creds.userToken) return missingCredentials('user');

      try {
        const result = await runSlack(
          creds,
          searchMessages({
            query: params.query,
            count: params.count,
            sort: params.sort,
            sortDir: params.sort_dir,
            cursor: params.cursor,
          }),
        );
        return textResult(formatSearchResults(result, params.query), {
          total: result.total,
          count: result.matches.length,
          cursor: result.cursor,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // slack_download_file
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_download_file',
    label: 'Slack Download File',
    description:
      'Download a file or image shared in Slack. Saves to a temp directory and returns the local path. Use `read` to view downloaded images.',
    promptSnippet: 'Download a Slack file/image to local temp directory',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: downloadFileParams,

    async execute(_toolCallId: string, params: { file_id: string }) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');

      try {
        const result = await runSlack(creds, downloadFile(params.file_id));
        return textResult(formatDownloadedFile(result), {
          fileId: result.info.id,
          localPath: result.localPath,
          isImage: result.info.isImage,
          mimetype: result.info.mimetype,
          size: result.info.size,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // slack_post_message
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_post_message',
    label: 'Slack Post Message',
    description:
      'Post a message to a Slack channel or reply in a thread. Requires the bot token to have the `chat:write` scope and the bot to be a member of the channel.',
    promptSnippet: 'Post a message to a Slack channel or thread',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: postMessageParams,

    async execute(
      _toolCallId: string,
      params: {
        channel: string;
        text: string;
        thread_ts?: string;
        reply_broadcast?: boolean;
      },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');

      try {
        const result = await runSlack(
          creds,
          postMessage({
            channel: params.channel,
            text: params.text,
            threadTs: params.thread_ts,
            replyBroadcast: params.reply_broadcast,
          }),
        );
        return textResult(formatPostedMessage(result, params.thread_ts), {
          channel: result.channel,
          ts: result.ts,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // slack_edit_message
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_edit_message',
    label: 'Slack Edit Message',
    description:
      'Edit a message the bot previously posted. Requires the bot token to have the `chat:write` scope. Bots can only edit their own messages.',
    promptSnippet: 'Edit a message the bot previously posted',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: editMessageParams,

    async execute(
      _toolCallId: string,
      params: {
        channel: string;
        ts: string;
        text: string;
      },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');

      try {
        const result = await runSlack(
          creds,
          editMessage({
            channel: params.channel,
            ts: params.ts,
            text: params.text,
          }),
        );
        return textResult(formatEditedMessage(result), {
          channel: result.channel,
          ts: result.ts,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // slack_delete_message
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: 'slack_delete_message',
    label: 'Slack Delete Message',
    description:
      'Delete a message the bot previously posted. Requires the bot token to have the `chat:write` scope. Bots can only delete their own messages.',
    promptSnippet: 'Delete a message the bot previously posted',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: deleteMessageParams,

    async execute(
      _toolCallId: string,
      params: {
        channel: string;
        ts: string;
      },
    ) {
      const creds = getCredentials();
      if (!creds) return missingCredentials('bot');

      try {
        const result = await runSlack(
          creds,
          deleteMessage({
            channel: params.channel,
            ts: params.ts,
          }),
        );
        return textResult(formatDeletedMessage(result), {
          channel: result.channel,
          ts: result.ts,
        });
      } catch (err) {
        return errorResult(`❌ ${(err as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // /slack command — status check
  // -------------------------------------------------------------------------

  pi.registerCommand('slack', {
    description: 'Show Slack extension configuration and connection status',
    handler: async (
      _args: string,
      ctx: {
        cwd: string;
        hasUI: boolean;
        ui: { notify(message: string, level: 'info' | 'warning' | 'error'): void };
      },
    ) => {
      const credStatus = getCredentialStatus();
      const config = projectConfig ?? (await loadProjectConfig(ctx.cwd).catch(() => null));

      const lines: string[] = ['Slack Extension Status', ''];

      lines.push(
        `Bot Token: ${credStatus.hasBotToken ? '✅ Set' : '❌ Missing (SLACK_BOT_TOKEN)'}`,
      );
      lines.push(
        `User Token: ${credStatus.hasUserToken ? '✅ Set' : '⚠️ Missing (SLACK_USER_TOKEN) — search disabled'}`,
      );
      lines.push('');

      if (config) {
        lines.push('Project Config (.pi/slack.json):');
        lines.push(`  Default channel: ${config.defaultChannel ?? '(not set)'}`);
        lines.push(`  Message limit: ${config.messageLimit}`);
      } else {
        lines.push('No .pi/slack.json found — using defaults.');
      }

      if (ctx.hasUI) {
        ctx.ui.notify(lines.join('\n'), 'info');
      }
    },
  });
}
