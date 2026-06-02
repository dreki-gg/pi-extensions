import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { resolve } from 'node:path';

import { discoverLensesEffect, getLensContentEffect } from '../extensions/code-reviewer/lenses';
import { fileSystemLayer } from './helpers';

const lensDir = '/repo/.code-review/lenses';

const codeQuality = `# Code Quality

Catches obvious quality issues.

## Criteria
- no dead code
- consistent naming

## Tools
- \`bun run lint\`
- bun run typecheck

## Severity
- blocker: breaks the build
- warning: smells
- note: nitpick
`;

function discover(opts: Parameters<typeof fileSystemLayer>[0]) {
  return Effect.runPromise(
    discoverLensesEffect(lensDir).pipe(Effect.provide(fileSystemLayer(opts))),
  );
}

describe('discoverLensesEffect', () => {
  test('returns empty map when the lens dir is missing', async () => {
    const lenses = await discover({});
    expect(lenses.size).toBe(0);
  });

  test('parses lens markdown into structured config', async () => {
    const lenses = await discover({
      dirs: { [lensDir]: ['code-quality.md', 'README.md', 'notes.txt'] },
      files: {
        [resolve(lensDir, 'code-quality.md')]: codeQuality,
        [resolve(lensDir, 'README.md')]: '# Readme\n',
      },
    });

    // Only .md files are considered; both code-quality and README qualify.
    expect([...lenses.keys()].sort()).toEqual(['README', 'code-quality']);

    const lens = lenses.get('code-quality')!;
    expect(lens.name).toBe('Code Quality');
    expect(lens.description).toBe('Catches obvious quality issues.');
    expect(lens.tools).toEqual(['bun run lint', 'bun run typecheck']);
    expect(lens.severityRules.blocker).toBe('breaks the build');
    expect(lens.severityRules.note).toBe('nitpick');
  });
});

describe('getLensContentEffect', () => {
  test('returns raw content when the lens exists', async () => {
    const content = await Effect.runPromise(
      getLensContentEffect(lensDir, 'code-quality').pipe(
        Effect.provide(
          fileSystemLayer({ files: { [resolve(lensDir, 'code-quality.md')]: codeQuality } }),
        ),
      ),
    );
    expect(content).toBe(codeQuality);
  });

  test('returns null when the lens is missing', async () => {
    const content = await Effect.runPromise(
      getLensContentEffect(lensDir, 'missing').pipe(Effect.provide(fileSystemLayer({}))),
    );
    expect(content).toBeNull();
  });
});
