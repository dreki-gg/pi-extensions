import { Data } from 'effect';

/** Discord API returned a non-2xx status. */
export class DiscordApiError extends Data.TaggedError('DiscordApiError')<{
  readonly route: string;
  readonly status: number;
  readonly code?: number;
  readonly detail?: string;
}> {
  get message(): string {
    const code = this.code !== undefined ? ` (code ${this.code})` : '';
    return `Discord API error [${this.route}]: HTTP ${this.status}${code}${this.detail ? ` — ${this.detail}` : ''}`;
  }
}

/** Missing or invalid authentication token. */
export class DiscordAuthError extends Data.TaggedError('DiscordAuthError')<{
  readonly reason: string;
}> {
  get message(): string {
    return `Discord auth error: ${this.reason}`;
  }
}

/** Rate limited by Discord — includes retry-after seconds when available. */
export class DiscordRateLimitError extends Data.TaggedError('DiscordRateLimitError')<{
  readonly route: string;
  readonly retryAfter?: number;
}> {
  get message(): string {
    return `Discord rate limited [${this.route}]${this.retryAfter ? ` — retry after ${this.retryAfter}s` : ''}`;
  }
}

/** File/attachment download or processing failed. */
export class DiscordFileError extends Data.TaggedError('DiscordFileError')<{
  readonly url: string;
  readonly reason: string;
}> {
  get message(): string {
    return `Discord file error [${this.url}]: ${this.reason}`;
  }
}

/** Union of all Discord client errors. */
export type DiscordError =
  | DiscordApiError
  | DiscordAuthError
  | DiscordRateLimitError
  | DiscordFileError;
