import { describe, test, expect } from 'bun:test';
import {
  DiscordApiError,
  DiscordAuthError,
  DiscordRateLimitError,
  DiscordFileError,
} from '../extensions/discord/client/errors.js';

describe('DiscordApiError', () => {
  test('has correct tag and message', () => {
    const err = new DiscordApiError({ route: '/channels/1/messages', status: 403 });
    expect(err._tag).toBe('DiscordApiError');
    expect(err.message).toContain('/channels/1/messages');
    expect(err.message).toContain('403');
  });

  test('includes code and detail when provided', () => {
    const err = new DiscordApiError({
      route: '/test',
      status: 404,
      code: 10003,
      detail: 'Unknown Channel',
    });
    expect(err.message).toContain('10003');
    expect(err.message).toContain('Unknown Channel');
  });
});

describe('DiscordAuthError', () => {
  test('has correct tag and message', () => {
    const err = new DiscordAuthError({ reason: 'token missing' });
    expect(err._tag).toBe('DiscordAuthError');
    expect(err.message).toContain('token missing');
  });
});

describe('DiscordRateLimitError', () => {
  test('includes retry-after', () => {
    const err = new DiscordRateLimitError({ route: '/channels/1/messages', retryAfter: 30 });
    expect(err._tag).toBe('DiscordRateLimitError');
    expect(err.message).toContain('30s');
  });

  test('works without retry-after', () => {
    const err = new DiscordRateLimitError({ route: '/test' });
    expect(err.message).not.toContain('retry after');
  });
});

describe('DiscordFileError', () => {
  test('has correct tag and message', () => {
    const err = new DiscordFileError({ url: 'https://cdn/x.png', reason: 'not found' });
    expect(err._tag).toBe('DiscordFileError');
    expect(err.message).toContain('https://cdn/x.png');
    expect(err.message).toContain('not found');
  });
});
