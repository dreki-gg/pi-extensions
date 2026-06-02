import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';

import {
  buildLensResult,
  pickLensToolOutputs,
  runToolsEffect,
} from '../extensions/code-reviewer/reviewer';
import type { LensConfig } from '../extensions/code-reviewer/types';
import { fakeExecutor } from './helpers';

const lens: LensConfig = {
  name: 'Code Quality',
  description: 'desc',
  criteria: 'no dead code',
  tools: ['bun run lint', 'bun run typecheck'],
  severityRules: { blocker: 'b', warning: 'w', note: 'n' },
};

const opts = { timeoutMs: 60_000, concurrency: 4 };

describe('runToolsEffect', () => {
  test('captures stdout, and degrades a failed/timed-out tool gracefully', async () => {
    const { layer } = fakeExecutor((_cmd, args) => {
      const script = args[args.length - 1];
      if (script === 'bun run lint') return { stdout: 'lint clean', stderr: '' };
      return { fail: new Error('typecheck blew up') };
    });

    const outputs = await Effect.runPromise(
      runToolsEffect('/repo', lens.tools, opts, undefined).pipe(Effect.provide(layer)),
    );

    expect(outputs['bun run lint']).toBe('lint clean');
    expect(outputs['bun run typecheck']).toBe('(tool failed or timed out: bun run typecheck)');
  });

  test('dedupes commands shared across lenses — each runs ONCE', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: 'ok', stderr: '' }));

    // Two lenses' worth of tools, with overlap. Simulates the union the
    // command layer passes in.
    const union = [...new Set([...lens.tools, 'bun run lint', 'bun run test'])];
    const outputs = await Effect.runPromise(
      runToolsEffect('/repo', union, opts, undefined).pipe(Effect.provide(layer)),
    );

    // 'bun run lint' appeared twice across the inputs but executes once.
    const lintCalls = calls.filter((c) => c.args[c.args.length - 1] === 'bun run lint');
    expect(lintCalls).toHaveLength(1);
    expect(calls).toHaveLength(3); // lint, typecheck, test — distinct only
    expect(Object.keys(outputs).sort()).toEqual([
      'bun run lint',
      'bun run test',
      'bun run typecheck',
    ]);
  });

  test('respects an already-aborted signal by running no tools', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: 'x', stderr: '' }));
    const controller = new AbortController();
    controller.abort();

    const outputs = await Effect.runPromise(
      runToolsEffect('/repo', lens.tools, opts, controller.signal).pipe(Effect.provide(layer)),
    );

    expect(calls).toHaveLength(0);
    expect(outputs).toEqual({});
  });

  test('no tools → no executor calls', async () => {
    const { layer, calls } = fakeExecutor(() => ({ stdout: 'x', stderr: '' }));
    const outputs = await Effect.runPromise(
      runToolsEffect('/repo', [], opts, undefined).pipe(Effect.provide(layer)),
    );
    expect(calls).toHaveLength(0);
    expect(outputs).toEqual({});
  });
});

describe('pickLensToolOutputs', () => {
  test('selects only the tools a lens declares from the shared output map', () => {
    const all = { 'bun run lint': 'L', 'bun run typecheck': 'T', 'bun run test': 'X' };
    expect(pickLensToolOutputs(lens, all)).toEqual({
      'bun run lint': 'L',
      'bun run typecheck': 'T',
    });
  });
});

describe('buildLensResult', () => {
  test('embeds the lens body + tool outputs in the lens section (no diff inside)', () => {
    const result = buildLensResult(lens, '# lens body', { 'bun run lint': 'lint clean' });

    expect(result.lens).toBe('Code Quality');
    expect(result.toolOutputs?.['bun run lint']).toBe('lint clean');
    expect(result._lensSection).toContain('Code Quality');
    expect(result._lensSection).toContain('# lens body');
    expect(result._lensSection).toContain('lint clean');
    // The diff is assembled once by the command layer, never per lens.
    expect(result._lensSection).not.toContain('diff --git a b');
  });
});
