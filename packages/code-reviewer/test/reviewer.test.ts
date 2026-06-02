import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';

import {
  buildLensResult,
  pickLensToolOutputs,
  renderPipelineReport,
  runToolsEffect,
} from '../extensions/code-reviewer/reviewer';
import type {
  LensConfig,
  PipelineTelemetry,
  ValidatedFinding,
} from '../extensions/code-reviewer/types';
import type { DiffSource } from '../extensions/code-reviewer/diff';
import { fakeExecutor } from './helpers';

const lens: LensConfig = {
  name: 'Code Quality',
  description: 'desc',
  criteria: 'no dead code',
  tools: ['bun run lint', 'bun run typecheck'],
  severityRules: { blocker: 'b', warning: 'w', note: 'n' },
};

const opts = { timeoutMs: 60_000, concurrency: 4 };

const diffSource: DiffSource = { diff: 'x', stat: 's', label: 'all uncommitted changes' };

function telemetry(over: Partial<PipelineTelemetry> = {}): PipelineTelemetry {
  return {
    passes: 5,
    passFindingCounts: [],
    buckets: 0,
    candidates: 0,
    validated: 0,
    droppedFalsePositives: 0,
    droppedLowSignal: 0,
    failedPasses: 0,
    passModels: ['default', 'default', 'default', 'default', 'default'],
    validatorModel: 'default',
    ...over,
  };
}

describe('renderPipelineReport', () => {
  test('clean run (no failures, no findings) shows the green check', () => {
    const report = renderPipelineReport({ findings: [], telemetry: telemetry() }, diffSource);
    expect(report).toContain('✅');
    expect(report).not.toContain('Inconclusive');
  });

  test('all passes failed with no findings is inconclusive, never a clean check', () => {
    const report = renderPipelineReport(
      {
        findings: [],
        telemetry: telemetry({ failedPasses: 5, passErrorSample: 'model x unavailable' }),
      },
      diffSource,
    );
    expect(report).not.toContain('✅');
    expect(report).toContain('Inconclusive');
    expect(report).toContain('model x unavailable');
  });

  test('partial failure with no findings is flagged as partial, not clean', () => {
    const report = renderPipelineReport(
      { findings: [], telemetry: telemetry({ failedPasses: 2, passErrorSample: 'timeout' }) },
      diffSource,
    );
    expect(report).not.toContain('✅');
    expect(report).toContain('Partial');
    expect(report).toContain('2/5');
  });

  test('findings present with some failed passes carry a partial-coverage warning', () => {
    const finding: ValidatedFinding = {
      file: 'a.ts',
      line: 1,
      severity: 'warning',
      message: 'bug',
      category: 'x',
      votes: 2,
      passIndices: [0, 1],
      verdict: 'real',
      confidence: 0.8,
      models: ['default'],
    };
    const report = renderPipelineReport(
      {
        findings: [finding],
        telemetry: telemetry({ failedPasses: 1, buckets: 1, candidates: 1, validated: 1 }),
      },
      diffSource,
    );
    expect(report).toContain('## Findings');
    expect(report).toContain('Partial');
  });
});

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
