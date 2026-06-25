import { describe, expect, test } from 'bun:test';
import {
  parseChecks,
  parseCurrentPr,
  parseInlineComments,
  parsePrState,
  parsePrViewComments,
  parseSelfLogin,
} from '../extensions/pr-babysitter/engine/gh';

describe('parsePrState', () => {
  test('reads state, null on junk', () => {
    expect(parsePrState(JSON.stringify({ state: 'MERGED' }))).toBe('MERGED');
    expect(parsePrState('nope')).toBeNull();
    expect(parsePrState(JSON.stringify({}))).toBeNull();
  });
});

describe('parseCurrentPr', () => {
  test('parses a valid PR view', () => {
    const pr = parseCurrentPr(
      JSON.stringify({ number: 42, headRefName: 'feat/x', state: 'OPEN', url: 'http://x/42' }),
    );
    expect(pr).toEqual({ number: 42, headRefName: 'feat/x', state: 'OPEN', url: 'http://x/42' });
  });

  test('returns null on junk or missing number', () => {
    expect(parseCurrentPr('not json')).toBeNull();
    expect(parseCurrentPr(JSON.stringify({ headRefName: 'x' }))).toBeNull();
  });
});

describe('parseChecks', () => {
  test('normalizes bucket to lowercase and keeps link', () => {
    const checks = parseChecks(
      JSON.stringify([
        { name: 'build', bucket: 'FAIL', link: 'http://ci/1' },
        { name: 'lint', state: 'pass' },
      ]),
    );
    expect(checks).toEqual([
      { name: 'build', bucket: 'fail', link: 'http://ci/1' },
      { name: 'lint', bucket: 'pass', link: undefined },
    ]);
  });

  test('tolerates junk', () => {
    expect(parseChecks('boom')).toEqual([]);
    expect(parseChecks(JSON.stringify({}))).toEqual([]);
  });
});

describe('parsePrViewComments', () => {
  test('namespaces ids and drops empty bodies', () => {
    const comments = parsePrViewComments(
      JSON.stringify({
        comments: [
          { id: 'IC_1', author: { login: 'alice' }, body: 'looks good' },
          { id: 'IC_2', author: { login: 'bob' }, body: '   ' },
        ],
        reviews: [
          { id: 'PRR_1', author: { login: 'carol' }, body: 'please fix', state: 'CHANGES_REQUESTED' },
          { id: 'PRR_2', author: { login: 'dave' }, body: '', state: 'APPROVED' },
        ],
      }),
    );
    expect(comments).toEqual([
      { id: 'issue:IC_1', author: 'alice', body: 'looks good', kind: 'issue' },
      { id: 'review:PRR_1', author: 'carol', body: 'please fix', kind: 'review' },
    ]);
  });

  test('handles missing fields', () => {
    expect(parsePrViewComments('nope')).toEqual([]);
    expect(parsePrViewComments(JSON.stringify({}))).toEqual([]);
  });
});

describe('parseInlineComments', () => {
  test('parses numeric ids and user login', () => {
    const comments = parseInlineComments(
      JSON.stringify([
        { id: 123, user: { login: 'cursor[bot]' }, body: 'possible null deref', path: 'a.ts', line: 4 },
        { id: 124, user: { login: 'x' }, body: '' },
      ]),
    );
    expect(comments).toEqual([
      { id: 'inline:123', author: 'cursor[bot]', body: 'possible null deref', kind: 'inline' },
    ]);
  });
});

describe('parseSelfLogin', () => {
  test('reads login', () => {
    expect(parseSelfLogin(JSON.stringify({ login: 'me' }))).toBe('me');
    expect(parseSelfLogin('junk')).toBeUndefined();
  });
});
