import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { writeResultsFile } from '../extensions/datadog/output.js';

describe('writeResultsFile', () => {
  it('writes content to an absolute temp path that can be read back', async () => {
    const content = '## Datadog Log Search Results\nfull untruncated body';
    const path = await writeResultsFile(content);

    expect(isAbsolute(path)).toBe(true);
    expect(path.endsWith('.md')).toBe(true);

    const readBack = await readFile(path, 'utf-8');
    expect(readBack).toBe(content);
  });

  it('returns a distinct path on each call', async () => {
    const a = await writeResultsFile('a');
    const b = await writeResultsFile('b');
    expect(a).not.toBe(b);
  });
});
