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
  const DEFAULT_PIPELINE = {
    passes: 5,
    validate: true,
    minVotes: 2,
    concurrency: 5,
    temperature: 0.4,
    maxFindings: 50,
    recordRejections: true,
  };

  const DEFAULTS = {
    lensDir: '.code-review/lenses',
    defaultLenses: [],
    toolTimeoutMs: 60_000,
    toolConcurrency: 4,
    review: DEFAULT_PIPELINE,
    rejectionsFile: '.code-review/rejections.jsonl',
  };

  test('returns defaults when no config file exists', async () => {
    const config = await run({});
    expect(config).toEqual(DEFAULTS);
  });

  test('returns defaults when config JSON is malformed', async () => {
    const config = await run({ files: { [configPath]: '{ not json' } });
    expect(config).toEqual(DEFAULTS);
  });

  test('reads lensDir and defaultLenses from the config file', async () => {
    const config = await run({
      files: {
        [configPath]: JSON.stringify({ lensDir: 'review/lenses', defaultLenses: ['code-quality'] }),
      },
    });
    expect(config).toEqual({
      ...DEFAULTS,
      lensDir: 'review/lenses',
      defaultLenses: ['code-quality'],
    });
  });

  test('reads review pipeline overrides and tracks concurrency to pass count', async () => {
    const config = await run({
      files: {
        [configPath]: JSON.stringify({ review: { passes: 3, validate: false, minVotes: 1 } }),
      },
    });
    expect(config.review.passes).toBe(3);
    expect(config.review.validate).toBe(false);
    expect(config.review.minVotes).toBe(1);
    // concurrency defaults to the pass count when not set
    expect(config.review.concurrency).toBe(3);
    expect(config.review.temperature).toBe(0.4);
  });

  test('parses per-step model overrides (string + { model, reasoning })', async () => {
    const config = await run({
      files: {
        [configPath]: JSON.stringify({
          review: {
            passModels: [{ model: 'anthropic/claude-opus-4-8', reasoning: 'low' }],
            validateModel: { model: 'anthropic/claude-opus-4-8', reasoning: 'medium' },
          },
        }),
      },
    });
    expect(config.review.passModels).toEqual([
      { model: 'anthropic/claude-opus-4-8', reasoning: 'low' },
    ]);
    expect(config.review.validateModel).toEqual({
      model: 'anthropic/claude-opus-4-8',
      reasoning: 'medium',
    });
  });

  test('drops an invalid reasoning level but keeps the model', async () => {
    const config = await run({
      files: {
        [configPath]: JSON.stringify({
          review: { validateModel: { model: 'openai/gpt-5.5', reasoning: 'ultra' } },
        }),
      },
    });
    expect(config.review.validateModel).toEqual({ model: 'openai/gpt-5.5' });
  });

  test('allows passes: 0 to disable the pipeline, ignores invalid knobs', async () => {
    const config = await run({
      files: {
        [configPath]: JSON.stringify({ review: { passes: 0, minVotes: -2, temperature: 9 } }),
      },
    });
    expect(config.review.passes).toBe(0);
    expect(config.review.minVotes).toBe(2); // invalid → default
    expect(config.review.temperature).toBe(2); // clamped to max
  });

  test('fills missing fields with defaults', async () => {
    const config = await run({
      files: { [configPath]: JSON.stringify({ defaultLenses: ['a', 'b'] }) },
    });
    expect(config.lensDir).toBe('.code-review/lenses');
    expect(config.defaultLenses).toEqual(['a', 'b']);
    expect(config.toolTimeoutMs).toBe(60_000);
    expect(config.toolConcurrency).toBe(4);
  });

  test('reads toolTimeoutMs / toolConcurrency overrides', async () => {
    const config = await run({
      files: { [configPath]: JSON.stringify({ toolTimeoutMs: 15_000, toolConcurrency: 2 }) },
    });
    expect(config.toolTimeoutMs).toBe(15_000);
    expect(config.toolConcurrency).toBe(2);
  });

  test('ignores non-positive / invalid tool knobs, falling back to defaults', async () => {
    const config = await run({
      files: {
        [configPath]: JSON.stringify({ toolTimeoutMs: 0, toolConcurrency: -3 }),
      },
    });
    expect(config.toolTimeoutMs).toBe(60_000);
    expect(config.toolConcurrency).toBe(4);
  });
});
