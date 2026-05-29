import { Data } from 'effect';

/** Slack API returned an error response (ok: false). */
export class SlackApiError extends Data.TaggedError('SlackApiError')<{
  readonly method: string;
  readonly code: string;
  readonly detail?: string;
}> {
  get message(): string {
    return `Slack API error [${this.method}]: ${this.code}${this.detail ? ` — ${this.detail}` : ''}`;
  }
}

/** Missing or invalid authentication token. */
export class SlackAuthError extends Data.TaggedError('SlackAuthError')<{
  readonly reason: string;
}> {
  get message(): string {
    return `Slack auth error: ${this.reason}`;
  }
}

/** Rate limited by Slack — includes retry-after seconds when available. */
export class SlackRateLimitError extends Data.TaggedError('SlackRateLimitError')<{
  readonly method: string;
  readonly retryAfter?: number;
}> {
  get message(): string {
    return `Slack rate limited [${this.method}]${this.retryAfter ? ` — retry after ${this.retryAfter}s` : ''}`;
  }
}

/** File download or processing failed. */
export class SlackFileError extends Data.TaggedError('SlackFileError')<{
  readonly fileId: string;
  readonly reason: string;
}> {
  get message(): string {
    return `Slack file error [${this.fileId}]: ${this.reason}`;
  }
}

/** Union of all Slack client errors. */
export type SlackError = SlackApiError | SlackAuthError | SlackRateLimitError | SlackFileError;
