import { describe, test, expect } from 'bun:test';
import {
  SlackApiError,
  SlackAuthError,
  SlackRateLimitError,
  SlackFileError,
} from '../extensions/slack/client/errors.js';

describe('SlackApiError', () => {
  test('has correct tag and message', () => {
    const err = new SlackApiError({ method: 'conversations.history', code: 'channel_not_found' });
    expect(err._tag).toBe('SlackApiError');
    expect(err.message).toContain('conversations.history');
    expect(err.message).toContain('channel_not_found');
  });

  test('includes detail when provided', () => {
    const err = new SlackApiError({ method: 'test', code: 'err', detail: 'extra info' });
    expect(err.message).toContain('extra info');
  });
});

describe('SlackAuthError', () => {
  test('has correct tag and message', () => {
    const err = new SlackAuthError({ reason: 'token missing' });
    expect(err._tag).toBe('SlackAuthError');
    expect(err.message).toContain('token missing');
  });
});

describe('SlackRateLimitError', () => {
  test('includes retry-after', () => {
    const err = new SlackRateLimitError({ method: 'search.messages', retryAfter: 30 });
    expect(err._tag).toBe('SlackRateLimitError');
    expect(err.message).toContain('30s');
  });

  test('works without retry-after', () => {
    const err = new SlackRateLimitError({ method: 'test' });
    expect(err.message).not.toContain('retry after');
  });
});

describe('SlackFileError', () => {
  test('has correct tag and message', () => {
    const err = new SlackFileError({ fileId: 'F123', reason: 'not found' });
    expect(err._tag).toBe('SlackFileError');
    expect(err.message).toContain('F123');
    expect(err.message).toContain('not found');
  });
});
