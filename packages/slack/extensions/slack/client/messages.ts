import { Effect } from 'effect';
import { slackPost } from './http.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostMessageResult {
  /** Timestamp of the posted message (also used as thread_ts for replies). */
  ts: string;
  /** Channel the message was posted to. */
  channel: string;
}

export interface EditMessageResult {
  /** Timestamp of the edited message. */
  ts: string;
  /** Channel the message lives in. */
  channel: string;
}

export interface DeleteMessageResult {
  /** Timestamp of the deleted message. */
  ts: string;
  /** Channel the message lived in. */
  channel: string;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export function postMessage(params: {
  channel: string;
  text: string;
  threadTs?: string;
  replyBroadcast?: boolean;
}) {
  return Effect.gen(function* () {
    const body: Record<string, unknown> = {
      channel: params.channel,
      text: params.text,
    };
    if (params.threadTs !== undefined) body.thread_ts = params.threadTs;
    if (params.replyBroadcast !== undefined) body.reply_broadcast = params.replyBroadcast;

    const resp = yield* slackPost<{ ok: true; ts: string; channel: string }>(
      'chat.postMessage',
      body,
    );

    return {
      ts: resp.ts,
      channel: resp.channel,
    } satisfies PostMessageResult;
  });
}

export function editMessage(params: { channel: string; ts: string; text: string }) {
  return Effect.gen(function* () {
    const resp = yield* slackPost<{ ok: true; ts: string; channel: string }>('chat.update', {
      channel: params.channel,
      ts: params.ts,
      text: params.text,
    });

    return {
      ts: resp.ts,
      channel: resp.channel,
    } satisfies EditMessageResult;
  });
}

export function deleteMessage(params: { channel: string; ts: string }) {
  return Effect.gen(function* () {
    const resp = yield* slackPost<{ ok: true; ts: string; channel: string }>('chat.delete', {
      channel: params.channel,
      ts: params.ts,
    });

    return {
      ts: resp.ts,
      channel: resp.channel,
    } satisfies DeleteMessageResult;
  });
}
