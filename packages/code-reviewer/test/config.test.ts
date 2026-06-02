import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { resolve } from 'node:path';

import { loadConfigEffect } from '../extensions/code-reviewer/config';
import { fileSystemLayer } from './helpers';

const cwd = '/repo';
const configPath = resolve(cwd, '.code-review.json');

function run(opts: Parameters<typeof fileSystemLayer>[0]) {
  return Effect.runPromise(loadConfigEffect(cwd).pipe(Effect.provide(fileSystemLayer(opts))));
}

describe('loadConfigEffect', () => {
  test('returns defaults when no config file exists', async () => {
    const config = await run({});
    expect(config).toEqual({ lensDir: '.code-review/lenses', defaultLenses: [] });
  });

  test('returns defaults when config JSON is malformed', async () => {
    const config = await run({ files: { [configPath]: '{ not json' } });
    expect(config).toEqual({ lensDir: '.code-review/lenses', defaultLenses: [] });
  });

  test('reads lensDir and defaultLenses from the config file', async () => {
    const config = await run({
      files: {
        [configPath]: JSON.stringify({ lensDir: 'review/lenses', defaultLenses: ['code-quality'] }),
      },
    });
    expect(config).toEqual({ lensDir: 'review/lenses', defaultLenses: ['code-quality'] });
  });

  test('fills missing fields with defaults', async () => {
    const config = await run({
      files: { [configPath]: JSON.stringify({ defaultLenses: ['a', 'b'] }) },
    });
    expect(config.lensDir).toBe('.code-review/lenses');
    expect(config.defaultLenses).toEqual(['a', 'b']);
  });
});
