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
