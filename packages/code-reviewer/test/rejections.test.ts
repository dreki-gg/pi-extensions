import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  appendRejections,
  applyRejections,
  loadRejections,
  matchesRejection,
  toRejectionRecords,
} from '../extensions/code-reviewer/rejections';
import type {
  CandidateFinding,
  RejectionRecord,
  ValidatedFinding,
} from '../extensions/code-reviewer/types';

let dir: string;
let path: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cr-rejections-'));
  path = join(dir, 'sub', 'rejections.jsonl');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const rec = (over: Partial<RejectionRecord> = {}): RejectionRecord => ({
  file: 'a.ts',
  line: 10,
  severity: 'warning',
  message: 'possible null dereference of user',
  recorded_at: '2026-01-01T00:00:00Z',
  ...over,
});

const candidate = (over: Partial<CandidateFinding> = {}): CandidateFinding => ({
  file: 'a.ts',
  line: 10,
  severity: 'warning',
  message: 'possible null dereference of user',
  votes: 1,
  passIndices: [0],
  ...over,
});

const validated = (over: Partial<ValidatedFinding> = {}): ValidatedFinding => ({
  ...candidate(over),
  verdict: 'real',
  confidence: 0.8,
  models: ['default'],
  ...over,
});

describe('loadRejections', () => {
  test('missing file returns empty', async () => {
    expect(await loadRejections(path)).toEqual([]);
  });

  test('skips garbled lines, keeps valid records', async () => {
    await appendRejections(path, [rec()]);
    await readFile(path, 'utf8'); // ensure written
    // Manually corrupt by appending junk.
    const { appendFile } = await import('node:fs/promises');
    await appendFile(path, 'not json\n', 'utf8');
    const loaded = await loadRejections(path);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].file).toBe('a.ts');
  });
});

describe('appendRejections', () => {
  test('creates the file and parent dir', async () => {
    await appendRejections(path, [rec()]);
    expect(await loadRejections(path)).toHaveLength(1);
  });

  test('dedupes against an existing matching rejection', async () => {
    await appendRejections(path, [rec()]);
    await appendRejections(path, [rec({ message: 'user may be null dereference here', line: 11 })]);
    expect(await loadRejections(path)).toHaveLength(1);
  });

  test('caps the store to the most recent N', async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      rec({ file: `f${i}.ts`, message: `distinct bug number ${i}` }),
    );
    await appendRejections(path, many, 3);
    expect(await loadRejections(path)).toHaveLength(3);
  });

  test('empty input is a no-op (no file created)', async () => {
    await appendRejections(path, []);
    expect(await loadRejections(path)).toEqual([]);
  });
});

describe('matchesRejection', () => {
  test('co-located similar message matches', () => {
    expect(
      matchesRejection({ file: 'a.ts', line: 11, message: 'user may be null dereference' }, [rec()]),
    ).toBe(true);
  });
  test('different file does not match', () => {
    expect(matchesRejection({ file: 'b.ts', line: 10, message: 'null dereference' }, [rec()])).toBe(
      false,
    );
  });
});

describe('applyRejections', () => {
  test('tags matches and downranks them below non-rejected', () => {
    const findings = [
      validated({ file: 'a.ts', message: 'possible null dereference of user' }),
      validated({ file: 'b.ts', line: 5, message: 'unrelated resource leak here' }),
    ];
    const out = applyRejections(findings, [rec()]);
    expect(out[0].file).toBe('b.ts');
    expect(out[0].previouslyRejected).toBeUndefined();
    expect(out[1].file).toBe('a.ts');
    expect(out[1].previouslyRejected).toBe(true);
  });

  test('no rejections returns findings unchanged', () => {
    const findings = [validated()];
    expect(applyRejections(findings, [])).toBe(findings);
  });
});

describe('toRejectionRecords', () => {
  test('maps candidates and stamps recorded_at', () => {
    const out = toRejectionRecords([candidate()], '2026-02-02T00:00:00Z');
    expect(out[0]).toEqual({
      file: 'a.ts',
      line: 10,
      severity: 'warning',
      message: 'possible null dereference of user',
      recorded_at: '2026-02-02T00:00:00Z',
    });
  });
});
