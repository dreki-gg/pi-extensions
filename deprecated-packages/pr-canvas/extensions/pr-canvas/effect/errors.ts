import { Data } from 'effect';

// ── GitHub CLI errors ──────────────────────────────────────────────────

/** A `gh` CLI command failed (non-zero exit code) */
export class GhCliError extends Data.TaggedError('GhCliError')<{
  readonly command: string;
  readonly stderr: string;
}> {}

/** The user is not authenticated with `gh auth` */
export class GhAuthError extends Data.TaggedError('GhAuthError')<{
  readonly message: string;
}> {}

/** The requested PR was not found */
export class GhNotFoundError extends Data.TaggedError('GhNotFoundError')<{
  readonly prRef: string;
}> {}

// ── WebSocket bridge errors ────────────────────────────────────────────

/** The WebSocket bridge server failed to start or encountered a fatal error */
export class WsBridgeError extends Data.TaggedError('WsBridgeError')<{
  readonly reason: string;
}> {}

/** A WebSocket client connection failed or was dropped unexpectedly */
export class WsConnectionError extends Data.TaggedError('WsConnectionError')<{
  readonly reason: string;
}> {}

// ── Server manager errors ──────────────────────────────────────────────

/** The SolidStart server process failed to start or become ready */
export class ServerStartError extends Data.TaggedError('ServerStartError')<{
  readonly reason: string;
}> {}

/** The SolidStart server process failed to stop cleanly */
export class ServerStopError extends Data.TaggedError('ServerStopError')<{
  readonly reason: string;
}> {}

// ── AI service errors ──────────────────────────────────────────────────

/** The AI chat request failed (model unavailable, timeout, etc.) */
export class AiChatError extends Data.TaggedError('AiChatError')<{
  readonly message: string;
}> {}
