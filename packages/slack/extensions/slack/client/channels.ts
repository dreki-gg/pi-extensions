import { Effect } from 'effect';
import { slackGet } from './http.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  topic: string;
  purpose: string;
  numMembers: number;
}

export interface SlackMessage {
  user: string;
  text: string;
  ts: string;
  threadTs?: string;
  replyCount?: number;
  reactions?: Array<{ name: string; count: number }>;
  files?: Array<{ id: string; name: string; mimetype: string; urlPrivate: string }>;
}

export interface ListChannelsResult {
  channels: SlackChannel[];
  cursor?: string;
}

export interface ReadMessagesResult {
  messages: SlackMessage[];
  hasMore: boolean;
  cursor?: string;
}

// ---------------------------------------------------------------------------
// API response shapes (raw from Slack)
// ---------------------------------------------------------------------------

interface RawChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  topic?: { value: string };
  purpose?: { value: string };
  num_members: number;
}

interface RawMessage {
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; count: number }>;
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private: string;
  }>;
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeChannel(raw: RawChannel): SlackChannel {
  return {
    id: raw.id,
    name: raw.name,
    isPrivate: raw.is_private,
    isMember: raw.is_member,
    topic: raw.topic?.value ?? '',
    purpose: raw.purpose?.value ?? '',
    numMembers: raw.num_members,
  };
}

function normalizeMessage(raw: RawMessage): SlackMessage {
  const msg: SlackMessage = {
    user: raw.user ?? 'unknown',
    text: raw.text ?? '',
    ts: raw.ts,
  };
  if (raw.thread_ts) msg.threadTs = raw.thread_ts;
  if (raw.reply_count) msg.replyCount = raw.reply_count;
  if (raw.reactions) msg.reactions = raw.reactions;
  if (raw.files) {
    msg.files = raw.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimetype: f.mimetype,
      urlPrivate: f.url_private,
    }));
  }
  return msg;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export function listChannels(params: { limit?: number; cursor?: string; types?: string }) {
  return Effect.gen(function* () {
    const resp = yield* slackGet<{
      ok: true;
      channels: RawChannel[];
      response_metadata?: { next_cursor?: string };
    }>('conversations.list', {
      limit: params.limit ?? 100,
      cursor: params.cursor,
      types: params.types ?? 'public_channel,private_channel',
      exclude_archived: true,
    });

    return {
      channels: resp.channels.map(normalizeChannel),
      cursor: resp.response_metadata?.next_cursor || undefined,
    } satisfies ListChannelsResult;
  });
}

export function readMessages(params: {
  channel: string;
  limit?: number;
  oldest?: string;
  latest?: string;
  cursor?: string;
}) {
  return Effect.gen(function* () {
    const resp = yield* slackGet<{
      ok: true;
      messages: RawMessage[];
      has_more: boolean;
      response_metadata?: { next_cursor?: string };
    }>('conversations.history', {
      channel: params.channel,
      limit: params.limit ?? 50,
      oldest: params.oldest,
      latest: params.latest,
      cursor: params.cursor,
    });

    return {
      messages: resp.messages.map(normalizeMessage),
      hasMore: resp.has_more,
      cursor: resp.response_metadata?.next_cursor || undefined,
    } satisfies ReadMessagesResult;
  });
}

export function readThread(params: {
  channel: string;
  threadTs: string;
  limit?: number;
  cursor?: string;
}) {
  return Effect.gen(function* () {
    const resp = yield* slackGet<{
      ok: true;
      messages: RawMessage[];
      has_more: boolean;
      response_metadata?: { next_cursor?: string };
    }>('conversations.replies', {
      channel: params.channel,
      ts: params.threadTs,
      limit: params.limit ?? 100,
      cursor: params.cursor,
    });

    return {
      messages: resp.messages.map(normalizeMessage),
      hasMore: resp.has_more,
      cursor: resp.response_metadata?.next_cursor || undefined,
    } satisfies ReadMessagesResult;
  });
}
