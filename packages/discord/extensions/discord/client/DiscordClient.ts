import { Layer } from 'effect';
import type { DiscordCredentials } from '../config.js';
import { DiscordConfig, DiscordHttpLive } from './http.js';

/**
 * Builds the runtime layer that the Discord Effect programs require:
 * the credentials (DiscordConfig) plus the retrying HttpClient (DiscordHttpLive).
 *
 * Used at the `Effect.runPromise` boundary in the tool execute handlers.
 * The individual operations (listChannels, readMessages, downloadAttachment, …)
 * are imported directly from their domain modules.
 */
export function makeRuntimeLayer(credentials: DiscordCredentials) {
  return Layer.merge(Layer.succeed(DiscordConfig, credentials), DiscordHttpLive);
}
