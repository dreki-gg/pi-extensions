import { Layer } from 'effect';
import type { SlackCredentials } from '../config.js';
import { SlackConfig, SlackHttpLive } from './http.js';

/**
 * Builds the runtime layer that the Slack Effect programs require:
 * the credentials (SlackConfig) plus the retrying HttpClient (SlackHttpLive).
 *
 * Used at the `Effect.runPromise` boundary in the tool execute handlers.
 * The individual operations (listChannels, readMessages, searchMessages,
 * downloadFile, …) are imported directly from their domain modules.
 */
export function makeRuntimeLayer(credentials: SlackCredentials) {
  return Layer.merge(Layer.succeed(SlackConfig, credentials), SlackHttpLive);
}
