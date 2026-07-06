import { FetchHttpClient, HttpClient } from '@effect/platform';
import { Context, Effect, Layer, Schedule } from 'effect';
import type { DiscordCredentials } from '../config.js';
import { DiscordApiError, DiscordAuthError, DiscordRateLimitError } from './errors.js';

// ---------------------------------------------------------------------------
// DiscordConfig service — provides credentials to the HTTP layer
// ---------------------------------------------------------------------------

export class DiscordConfig extends Context.Tag('DiscordConfig')<
  DiscordConfig,
  DiscordCredentials
>() {}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISCORD_BASE_URL = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://github.com/dreki-gg/pi-extensions, 0.1.0)';

interface DiscordErrorBody {
  message?: string;
  code?: number;
}

/**
 * Make a GET request to a Discord REST route, returning typed JSON.
 * Handles auth injection, rate limiting (with retry), and error mapping.
 *
 * Unlike Slack, Discord has no `ok` envelope — success is any 2xx status and
 * the body is a raw array/object; failures are non-2xx with a `{ message, code }`
 * body.
 */
export function discordGet<T>(
  route: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  return Effect.scoped(
    Effect.gen(function* () {
      const config = yield* DiscordConfig;
      const client = yield* HttpClient.HttpClient;

      if (!config.botToken) {
        return yield* new DiscordAuthError({ reason: 'DISCORD_BOT_TOKEN is required but not set' });
      }

      const url = new URL(`${DISCORD_BASE_URL}${route}`);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }

      const response = yield* client.get(url.toString(), {
        headers: {
          Authorization: `Bot ${config.botToken}`,
          'User-Agent': USER_AGENT,
        },
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers['retry-after']) || undefined;
        return yield* new DiscordRateLimitError({ route, retryAfter });
      }

      if (response.status < 200 || response.status >= 300) {
        const body = (yield* Effect.orElseSucceed(response.json, () => ({}))) as DiscordErrorBody;
        return yield* new DiscordApiError({
          route,
          status: response.status,
          code: body.code,
          detail: body.message,
        });
      }

      return (yield* response.json) as T;
    }),
  );
}

/**
 * Download a Discord attachment from its CDN URL.
 * Attachment URLs are public — no Authorization header is sent.
 * Returns the raw ArrayBuffer.
 */
export function discordDownload(url: string) {
  return Effect.scoped(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      const response = yield* client.get(url, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (response.status !== 200) {
        return yield* Effect.fail(new Error(`Download failed with status ${response.status}`));
      }

      return yield* response.arrayBuffer;
    }),
  );
}

// ---------------------------------------------------------------------------
// Retry policy — respects rate limit backoff
// ---------------------------------------------------------------------------

const retryPolicy = Schedule.intersect(Schedule.recurs(3), Schedule.exponential('1 second'));

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/** FetchHttpClient with retry policy for Discord rate limits. */
export const DiscordHttpLive = FetchHttpClient.layer.pipe(
  Layer.map((context) => {
    const client = Context.get(context, HttpClient.HttpClient);
    const retried = client.pipe(HttpClient.retry(retryPolicy));
    return Context.make(HttpClient.HttpClient, retried);
  }),
);
