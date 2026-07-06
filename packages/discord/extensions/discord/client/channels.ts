import { Effect } from 'effect';
import { discordGet } from './http.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  topic: string;
  parentId?: string;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  contentType?: string;
  width?: number;
  height?: number;
}

export interface DiscordMessage {
  id: string;
  author: string;
  authorId: string;
  isBot: boolean;
  content: string;
  timestamp: string;
  editedTimestamp?: string;
  attachments?: DiscordAttachment[];
  reactions?: Array<{ name: string; count: number }>;
}

export interface ListChannelsResult {
  channels: DiscordChannel[];
}

export interface ReadMessagesResult {
  messages: DiscordMessage[];
}

// ---------------------------------------------------------------------------
// API response shapes (raw from Discord)
// ---------------------------------------------------------------------------

interface RawChannel {
  id: string;
  name?: string;
  type: number;
  topic?: string | null;
  parent_id?: string | null;
}

interface RawAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  content_type?: string;
  width?: number;
  height?: number;
}

interface RawMessage {
  id: string;
  author?: {
    id: string;
    username?: string;
    global_name?: string | null;
    bot?: boolean;
  };
  content?: string;
  timestamp: string;
  edited_timestamp?: string | null;
  attachments?: RawAttachment[];
  reactions?: Array<{ count: number; emoji: { name: string | null } }>;
}

// ---------------------------------------------------------------------------
// Text-like channel types worth listing (text, announcement, threads, forum).
// ---------------------------------------------------------------------------

const TEXT_CHANNEL_TYPES = new Set([0, 5, 10, 11, 12, 15]);

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeChannel(raw: RawChannel): DiscordChannel {
  const channel: DiscordChannel = {
    id: raw.id,
    name: raw.name ?? '(unnamed)',
    type: raw.type,
    topic: raw.topic ?? '',
  };
  if (raw.parent_id) channel.parentId = raw.parent_id;
  return channel;
}

function normalizeAttachment(raw: RawAttachment): DiscordAttachment {
  const att: DiscordAttachment = {
    id: raw.id,
    filename: raw.filename,
    size: raw.size,
    url: raw.url,
  };
  if (raw.content_type) att.contentType = raw.content_type;
  if (raw.width !== undefined) att.width = raw.width;
  if (raw.height !== undefined) att.height = raw.height;
  return att;
}

function normalizeMessage(raw: RawMessage): DiscordMessage {
  const msg: DiscordMessage = {
    id: raw.id,
    author: raw.author?.global_name || raw.author?.username || 'unknown',
    authorId: raw.author?.id ?? 'unknown',
    isBot: Boolean(raw.author?.bot),
    content: raw.content ?? '',
    timestamp: raw.timestamp,
  };
  if (raw.edited_timestamp) msg.editedTimestamp = raw.edited_timestamp;
  if (raw.attachments && raw.attachments.length > 0) {
    msg.attachments = raw.attachments.map(normalizeAttachment);
  }
  if (raw.reactions && raw.reactions.length > 0) {
    msg.reactions = raw.reactions.map((r) => ({
      name: r.emoji.name ?? '?',
      count: r.count,
    }));
  }
  return msg;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export function listChannels(params: { guild: string }) {
  return Effect.gen(function* () {
    const resp = yield* discordGet<RawChannel[]>(`/guilds/${params.guild}/channels`, {});

    return {
      channels: resp
        .filter((c) => TEXT_CHANNEL_TYPES.has(c.type))
        .map(normalizeChannel),
    } satisfies ListChannelsResult;
  });
}

export function readMessages(params: {
  channel: string;
  limit?: number;
  before?: string;
  after?: string;
}) {
  return Effect.gen(function* () {
    const resp = yield* discordGet<RawMessage[]>(`/channels/${params.channel}/messages`, {
      limit: params.limit ?? 50,
      before: params.before,
      after: params.after,
    });

    return {
      messages: resp.map(normalizeMessage),
    } satisfies ReadMessagesResult;
  });
}
