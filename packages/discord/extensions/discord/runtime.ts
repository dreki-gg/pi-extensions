import { Effect } from 'effect';
import type { HttpClient } from '@effect/platform';
import type { DiscordConfig } from './client/http.js';
import type { DiscordCredentials } from './config.js';
import { makeRuntimeLayer } from './client/DiscordClient.js';

// ---------------------------------------------------------------------------
// Tool result helpers
// ---------------------------------------------------------------------------

export function textResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: (details ?? {}) as Record<string, unknown>,
  };
}

export function errorResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: (details ?? {}) as Record<string, unknown>,
    isError: true,
  };
}

export function missingCredentials() {
  return errorResult(
    '❌ Missing DISCORD_BOT_TOKEN.\n\nSet this environment variable to enable Discord tools.',
    { error: 'missing_credentials', missing: ['DISCORD_BOT_TOKEN'] },
  );
}

// ---------------------------------------------------------------------------
// Effect boundary — runs a program with the Discord runtime layer.
// ---------------------------------------------------------------------------

type DiscordRuntime = DiscordConfig | HttpClient.HttpClient;

export function runDiscord<A, E>(
  credentials: DiscordCredentials,
  program: Effect.Effect<A, E, DiscordRuntime>,
): Promise<A> {
  const layer = makeRuntimeLayer(credentials);
  return Effect.runPromise(program.pipe(Effect.provide(layer)));
}
