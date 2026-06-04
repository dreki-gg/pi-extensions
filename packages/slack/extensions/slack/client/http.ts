import { FetchHttpClient, HttpClient, HttpClientRequest } from '@effect/platform';
import { Context, Effect, Layer, Schedule } from 'effect';
import type { SlackCredentials } from '../config.js';
import { SlackApiError, SlackAuthError, SlackRateLimitError } from './errors.js';

// ---------------------------------------------------------------------------
// SlackConfig service — provides credentials to the HTTP layer
// ---------------------------------------------------------------------------

export class SlackConfig extends Context.Tag('SlackConfig')<SlackConfig, SlackCredentials>() {}

// ---------------------------------------------------------------------------
// Slack-specific JSON response shape
// ---------------------------------------------------------------------------

interface SlackOkResponse {
  ok: true;
  [key: string]: unknown;
}

interface SlackErrorResponse {
  ok: false;
  error: string;
}

type SlackResponse = SlackOkResponse | SlackErrorResponse;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLACK_BASE_URL = 'https://slack.com/api';

/**
 * Make a GET request to a Slack Web API method, returning typed JSON.
 * Handles auth injection, rate limiting (with retry), and error mapping.
 */
export function slackGet<T extends SlackOkResponse>(
  method: string,
  params: Record<string, string | number | boolean | undefined>,
  options?: { useUserToken?: boolean },
) {
  return Effect.scoped(
    Effect.gen(function* () {
      const config = yield* SlackConfig;
      const client = yield* HttpClient.HttpClient;

      const token = options?.useUserToken ? config.userToken : config.botToken;
      if (!token) {
        return yield* new SlackAuthError({
          reason: options?.useUserToken
            ? 'SLACK_USER_TOKEN is required for this operation but not set'
            : 'SLACK_BOT_TOKEN is required but not set',
        });
      }

      // Build URL with query params
      const url = new URL(`${SLACK_BASE_URL}/${method}`);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }

      const response = yield* client.get(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = Number(response.headers['retry-after']) || undefined;
        return yield* new SlackRateLimitError({ method, retryAfter });
      }

      const json = (yield* response.json) as SlackResponse;

      if (!json.ok) {
        return yield* new SlackApiError({
          method,
          code: (json as SlackErrorResponse).error,
        });
      }

      return json as T;
    }),
  );
}

/**
 * Make a POST request to a Slack Web API method with a JSON body.
 * Handles auth injection, rate limiting (with retry), and error mapping.
 */
export function slackPost<T extends SlackOkResponse>(
  method: string,
  body: Record<string, unknown>,
  options?: { useUserToken?: boolean },
) {
  return Effect.scoped(
    Effect.gen(function* () {
      const config = yield* SlackConfig;
      const client = yield* HttpClient.HttpClient;

      const token = options?.useUserToken ? config.userToken : config.botToken;
      if (!token) {
        return yield* new SlackAuthError({
          reason: options?.useUserToken
            ? 'SLACK_USER_TOKEN is required for this operation but not set'
            : 'SLACK_BOT_TOKEN is required but not set',
        });
      }

      const request = HttpClientRequest.post(`${SLACK_BASE_URL}/${method}`).pipe(
        HttpClientRequest.setHeaders({ Authorization: `Bearer ${token}` }),
        HttpClientRequest.bodyUnsafeJson(body),
      );

      const response = yield* client.execute(request);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = Number(response.headers['retry-after']) || undefined;
        return yield* new SlackRateLimitError({ method, retryAfter });
      }

      const json = (yield* response.json) as SlackResponse;

      if (!json.ok) {
        return yield* new SlackApiError({
          method,
          code: (json as SlackErrorResponse).error,
        });
      }

      return json as T;
    }),
  );
}

/**
 * Download a file from Slack using bot token authentication.
 * Returns the raw ArrayBuffer.
 */
export function slackDownload(url: string) {
  return Effect.scoped(
    Effect.gen(function* () {
      const config = yield* SlackConfig;
      const client = yield* HttpClient.HttpClient;

      if (!config.botToken) {
        return yield* new SlackAuthError({
          reason: 'SLACK_BOT_TOKEN is required for file downloads',
        });
      }

      const response = yield* client.get(url, {
        headers: { Authorization: `Bearer ${config.botToken}` },
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

/** FetchHttpClient with retry policy for Slack rate limits. */
export const SlackHttpLive = FetchHttpClient.layer.pipe(
  Layer.map((context) => {
    const client = Context.get(context, HttpClient.HttpClient);
    const retried = client.pipe(HttpClient.retry(retryPolicy));
    return Context.make(HttpClient.HttpClient, retried);
  }),
);
