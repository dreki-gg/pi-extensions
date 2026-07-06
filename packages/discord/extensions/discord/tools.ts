import { Type } from 'typebox';

// ---------------------------------------------------------------------------
// Prompt guidelines injected into the system prompt
// ---------------------------------------------------------------------------

export const TOOL_GUIDELINES = [
  'Use `discord_list_channels` to discover text channels in a server (guild) before reading messages. Provide a guild ID, or set `defaultGuild` in .pi/discord.json.',
  'Use `discord_read_messages` to read recent messages from a channel. Provide the channel ID. Messages come back oldest-first; use the `before` message ID to page further back in history.',
  'Use `discord_download_attachment` to save an image or file shared in a message. Pass the attachment `url` shown after 📎 — the tool downloads it to a temp path; use `read` to view images.',
  'Guild, channel, and message IDs are numeric snowflakes. In the Discord client, enable Developer Mode (Settings → Advanced) then right-click → Copy ID.',
  'The bot only sees servers it has been invited to and channels where it has View Channel + Read Message History permission.',
];

// ---------------------------------------------------------------------------
// Parameter schemas
// ---------------------------------------------------------------------------

export const listChannelsParams = Type.Object({
  guild: Type.Optional(
    Type.String({
      description:
        'Guild (server) ID. Falls back to defaultGuild in .pi/discord.json if omitted.',
    }),
  ),
});

export const readMessagesParams = Type.Object({
  channel: Type.String({
    description: 'Channel ID (numeric snowflake).',
  }),
  limit: Type.Optional(
    Type.Number({
      description: 'Max messages to return (1-100). Default from config or 50.',
      minimum: 1,
      maximum: 100,
    }),
  ),
  before: Type.Optional(
    Type.String({
      description: 'Only messages before this message ID (page further back in history).',
    }),
  ),
  after: Type.Optional(
    Type.String({
      description: 'Only messages after this message ID.',
    }),
  ),
});

export const downloadAttachmentParams = Type.Object({
  url: Type.String({
    description: 'Attachment CDN URL from a message (shown after 📎).',
  }),
});
