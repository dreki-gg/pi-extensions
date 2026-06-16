import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';

// ---------------------------------------------------------------------------
// Prompt guidelines injected into the system prompt
// ---------------------------------------------------------------------------

export const TOOL_GUIDELINES = [
  'Use `slack_list_channels` to discover available Slack channels before reading messages.',
  'Use `slack_read_messages` to read recent messages from a specific channel. Provide a channel ID (starts with C).',
  'Use `slack_read_thread` to read all replies in a thread. You need both the channel ID and the thread timestamp (thread_ts).',
  'Use `slack_search` for full-text search across the workspace. Requires SLACK_USER_TOKEN to be set.',
  'Use `slack_download_file` to download images or files shared in Slack. The tool saves files to a temp directory and returns the path — use `read` to view images.',
  'Use `slack_post_message` to send a message to a channel or reply in a thread. The bot token must have the `chat:write` scope and the bot must be a member of the target channel.',
  'Use `slack_edit_message` to edit a message the bot previously posted. Pass the channel ID and the message `ts` (returned by `slack_post_message`). Bots can only edit their own messages.',
  'Use `slack_delete_message` to delete a message the bot previously posted. Pass the channel ID and the message `ts`. Bots can only delete their own messages.',
  'When messages reference files or images (shown with 📎), download them with `slack_download_file` using the file ID to get visual context.',
  'Channel IDs look like C0123ABC456. Thread timestamps look like 1512085950.000216.',
];

// ---------------------------------------------------------------------------
// Parameter schemas
// ---------------------------------------------------------------------------

export const listChannelsParams = Type.Object({
  limit: Type.Optional(
    Type.Number({
      description: 'Max channels to return (1-200). Default 100.',
      minimum: 1,
      maximum: 200,
    }),
  ),
  cursor: Type.Optional(
    Type.String({ description: 'Pagination cursor from a previous response.' }),
  ),
  types: Type.Optional(
    Type.String({
      description: 'Comma-separated channel types. Default "public_channel,private_channel".',
    }),
  ),
});

export const readMessagesParams = Type.Object({
  channel: Type.String({
    description: 'Channel ID (e.g. C0123ABC456).',
  }),
  limit: Type.Optional(
    Type.Number({
      description: 'Max messages to return (1-100). Default from config or 50.',
      minimum: 1,
      maximum: 100,
    }),
  ),
  oldest: Type.Optional(
    Type.String({
      description: 'Only messages after this Unix timestamp.',
    }),
  ),
  latest: Type.Optional(
    Type.String({
      description: 'Only messages before this Unix timestamp.',
    }),
  ),
  cursor: Type.Optional(
    Type.String({ description: 'Pagination cursor from a previous response.' }),
  ),
});

export const readThreadParams = Type.Object({
  channel: Type.String({
    description: 'Channel ID where the thread lives.',
  }),
  thread_ts: Type.String({
    description: 'Timestamp of the parent message (thread_ts).',
  }),
  limit: Type.Optional(
    Type.Number({
      description: 'Max replies to return (1-200). Default 100.',
      minimum: 1,
      maximum: 200,
    }),
  ),
  cursor: Type.Optional(
    Type.String({ description: 'Pagination cursor from a previous response.' }),
  ),
});

const SORT_ENUM = ['score', 'timestamp'] as const;
const SORT_DIR_ENUM = ['asc', 'desc'] as const;

export const searchParams = Type.Object({
  query: Type.String({
    description:
      'Search query. Supports Slack search syntax (in:#channel, from:@user, has:link, etc.).',
  }),
  count: Type.Optional(
    Type.Number({
      description: 'Number of results (1-100). Default 20.',
      minimum: 1,
      maximum: 100,
    }),
  ),
  sort: Type.Optional(
    StringEnum(SORT_ENUM, { description: 'Sort by "score" or "timestamp". Default "timestamp".' }),
  ),
  sort_dir: Type.Optional(
    StringEnum(SORT_DIR_ENUM, { description: 'Sort direction. Default "desc".' }),
  ),
  cursor: Type.Optional(
    Type.String({ description: 'Pagination cursor from a previous response.' }),
  ),
});

export const downloadFileParams = Type.Object({
  file_id: Type.String({
    description: 'Slack file ID to download (e.g. F0123ABC456).',
  }),
});

export const postMessageParams = Type.Object({
  channel: Type.String({
    description: 'Channel ID (e.g. C0123ABC456) or #channel-name to post to.',
  }),
  text: Type.String({
    description: 'Message text. Supports Slack mrkdwn formatting.',
  }),
  thread_ts: Type.Optional(
    Type.String({
      description: 'Reply within this thread (the parent message ts).',
    }),
  ),
  reply_broadcast: Type.Optional(
    Type.Boolean({
      description:
        'When replying in a thread, also broadcast the reply to the channel. Default false.',
    }),
  ),
});

export const editMessageParams = Type.Object({
  channel: Type.String({
    description: 'Channel ID (e.g. C0123ABC456) where the message lives.',
  }),
  ts: Type.String({
    description: 'Timestamp of the message to edit (the `ts` returned by slack_post_message).',
  }),
  text: Type.String({
    description: 'New message text. Supports Slack mrkdwn formatting.',
  }),
});

export const deleteMessageParams = Type.Object({
  channel: Type.String({
    description: 'Channel ID (e.g. C0123ABC456) where the message lives.',
  }),
  ts: Type.String({
    description: 'Timestamp of the message to delete (the `ts` returned by slack_post_message).',
  }),
});
