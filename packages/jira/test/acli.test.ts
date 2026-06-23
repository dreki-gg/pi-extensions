import { describe, expect, test } from 'bun:test';
import {
  AcliError,
  buildAuthStatusArgs,
  buildCommentCreateArgs,
  buildCommentListArgs,
  buildSearchArgs,
  buildViewArgs,
  checkAuth,
  looksUnauthenticated,
  parseJsonOutput,
  runAcli,
} from '../extensions/jira/acli.js';

describe('argument builders', () => {
  test('auth status', () => {
    expect(buildAuthStatusArgs()).toEqual(['jira', 'auth', 'status']);
  });

  test('view passes key, fields, and json', () => {
    expect(buildViewArgs('PROJ-1', 'summary,comment')).toEqual([
      'jira',
      'workitem',
      'view',
      'PROJ-1',
      '--fields',
      'summary,comment',
      '--json',
    ]);
  });

  test('search builds jql + limit + json', () => {
    expect(buildSearchArgs({ jql: 'project = PROJ', limit: 10 })).toEqual([
      'jira',
      'workitem',
      'search',
      '--jql',
      'project = PROJ',
      '--limit',
      '10',
      '--json',
    ]);
  });

  test('search includes fields when provided', () => {
    const args = buildSearchArgs({ jql: 'x', limit: 5, fields: 'key,summary' });
    expect(args).toContain('--fields');
    expect(args).toContain('key,summary');
  });

  test('comment list', () => {
    expect(buildCommentListArgs('PROJ-2', 50)).toEqual([
      'jira',
      'workitem',
      'comment',
      'list',
      '--key',
      'PROJ-2',
      '--limit',
      '50',
      '--json',
    ]);
  });

  test('comment create keeps body as a single arg (no shell injection)', () => {
    const body = 'Done; see "PR #42" & notes';
    const args = buildCommentCreateArgs('PROJ-3', body);
    expect(args[args.indexOf('--body') + 1]).toBe(body);
  });
});

describe('looksUnauthenticated', () => {
  test.each([
    'You are not authenticated',
    'Please authenticate first',
    'No active session found',
    'run acli jira auth login',
    '401 Unauthorized',
  ])('detects %p', (text) => {
    expect(looksUnauthenticated(text)).toBe(true);
  });

  test('returns false for normal output', () => {
    expect(looksUnauthenticated('Logged in as user@example.com')).toBe(false);
  });
});

describe('parseJsonOutput', () => {
  test('parses clean JSON', () => {
    expect(parseJsonOutput<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  test('strips a leading status line before JSON', () => {
    expect(parseJsonOutput<{ key: string }>('Fetching...\n{"key":"X-1"}')).toEqual({
      key: 'X-1',
    });
  });

  test('throws AcliError on garbage', () => {
    expect(() => parseJsonOutput('not json at all')).toThrow(AcliError);
  });
});

describe('runAcli', () => {
  test('maps a missing binary to binary_not_found', async () => {
    let caught: unknown;
    try {
      await runAcli('definitely-not-a-real-binary-xyz', ['--version']);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AcliError);
    expect((caught as AcliError).code).toBe('binary_not_found');
  });
});

describe('checkAuth', () => {
  test('reports not authenticated when the binary is missing', async () => {
    const status = await checkAuth('definitely-not-a-real-binary-xyz');
    expect(status.authenticated).toBe(false);
    expect(status.message).toContain('not found');
  });
});
