import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';

import {
  buildInlineSummary,
  buildLensResult,
  buildPipelineResult,
  buildPointer,
  buildSinglePassResult,
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
    const report = renderPipelineReport(
      { findings: [], rejected: [], telemetry: telemetry() },
      diffSource,
    );
    expect(report).toContain('✅');
    expect(report).not.toContain('Inconclusive');
  });

  test('all passes failed with no findings is inconclusive, never a clean check', () => {
    const report = renderPipelineReport(
      {
        findings: [],
        rejected: [],
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
      { findings: [], rejected: [], telemetry: telemetry({ failedPasses: 2, passErrorSample: 'timeout' }) },
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
        rejected: [],
        telemetry: telemetry({ failedPasses: 1, buckets: 1, candidates: 1, validated: 1 }),
      },
      diffSource,
    );
    expect(report).toContain('## Findings');
    expect(report).toContain('Partial');
  });

  test('tags a previously-rejected finding in the report', () => {
    const finding: ValidatedFinding = {
      file: 'a.ts',
      line: 1,
      severity: 'warning',
      message: 'bug',
      votes: 2,
      passIndices: [0, 1],
      verdict: 'real',
      confidence: 0.8,
      models: ['default'],
      previouslyRejected: true,
    };
    const report = renderPipelineReport(
      {
        findings: [finding],
        rejected: [],
        telemetry: telemetry({ buckets: 1, candidates: 1, validated: 1 }),
      },
      diffSource,
    );
    expect(report).toContain('previously rejected');
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

describe('buildInlineSummary', () => {
  test('lists lens names and the diff label', () => {
    const summary = buildInlineSummary(['code-quality', 'maintainability'], diffSource);
    expect(summary).toContain('# Code Review Summary');
    expect(summary).toContain('code-quality, maintainability');
    expect(summary).toContain('all uncommitted changes');
  });

  test('condenses a git diffstat summary line into files/+/-', () => {
    const summary = buildInlineSummary(['code-quality'], {
      diff: 'x',
      label: 'all uncommitted changes',
      stat: ' a.ts | 2 +-\n b.ts | 5 +++--\n 2 files changed, 340 insertions(+), 89 deletions(-)',
    });
    expect(summary).toContain('all uncommitted changes (2 files, +340, -89)');
  });

  test('falls back to just the label when the diffstat has no summary line', () => {
    const summary = buildInlineSummary(['code-quality'], {
      diff: 'x',
      label: 'all uncommitted changes',
      stat: '',
    });
    expect(summary).toContain('- **Diff**: all uncommitted changes');
  });

  test('handles an empty lens list', () => {
    expect(buildInlineSummary([], diffSource)).toContain('**Lenses**: (none)');
  });
});

describe('buildPointer', () => {
  const pointer = { path: '/tmp/pi-code-review-123.md', bytes: 96_000, lines: 842 };

  test('single-pass: path, KB size, line count and a read offset/limit directive', () => {
    const out = buildPointer(pointer, 'single-pass');
    expect(out).toContain('/tmp/pi-code-review-123.md');
    expect(out).toContain('842 lines');
    expect(out).toContain('94KB'); // 96000 / 1024 rounded
    expect(out).toContain('Read that file');
    expect(out).toContain('offset/limit');
  });

  test('pipeline: path, size, line count and a read offset/limit directive', () => {
    const out = buildPointer(pointer, 'pipeline');
    expect(out).toContain('/tmp/pi-code-review-123.md');
    expect(out).toContain('842 lines');
    expect(out).toContain('94KB');
    expect(out).toContain('offset/limit');
    expect(out).toContain('---');
  });

  test('rounds tiny files up to at least 1KB', () => {
    const out = buildPointer({ path: '/tmp/x.md', bytes: 10, lines: 1 }, 'pipeline');
    expect(out).toContain('1KB');
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

// Tool-result content is `(TextContent | ImageContent)[]`; these helpers only
// ever emit text, so narrow to the text payload for assertions.
function firstText(result: {
  content: ReadonlyArray<{ type: string; text?: string }>;
}): string {
  const block = result.content[0];
  return block?.type === 'text' && block.text !== undefined ? block.text : '';
}

// A spy writer that records the spilled content and returns a fake pointer.
function okWriter() {
  const calls: string[] = [];
  const write = async (content: string) => {
    calls.push(content);
    return {
      path: '/tmp/pi-code-review-test.md',
      bytes: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };
  };
  return { write, calls };
}

// A writer that fails, simulating a read-only TMPDIR / full disk.
function failWriter() {
  const calls: string[] = [];
  const write = async (content: string) => {
    calls.push(content);
    throw new Error('EROFS: read-only file system');
  };
  return { write, calls };
}

const singlePassArgs = {
  results: [buildLensResult(lens, '# lens body', { 'bun run lint': 'lint clean' })],
  diff: diffSource,
  lensNames: ['code-quality'],
  availableLenses: ['code-quality', 'maintainability'],
  changedFiles: ['a.ts'],
};

describe('buildSinglePassResult', () => {
  test('spills the full context and returns a summary + pointer', async () => {
    const writer = okWriter();
    const result = await buildSinglePassResult(singlePassArgs, writer.write);

    // The full lens context was written to disk, not returned inline.
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0]).toContain('# lens body');

    const text = firstText(result);
    expect(text).toContain('# Code Review Summary');
    expect(text).toContain('code-quality');
    expect(text).toContain('/tmp/pi-code-review-test.md');
    expect(text).toContain('Read that file');
    expect(result.details.mode).toBe('single-pass');
    expect(result.details.contextFile).toBe('/tmp/pi-code-review-test.md');
  });

  test('no applicable lenses → notice, and never touches the disk', async () => {
    const writer = okWriter();
    const result = await buildSinglePassResult(
      { ...singlePassArgs, results: [], lensNames: [] },
      writer.write,
    );

    expect(writer.calls).toHaveLength(0);
    expect(firstText(result)).toContain('No applicable lenses');
    expect(result.details).not.toHaveProperty('contextFile');
  });

  test('write failure degrades to inline context instead of throwing', async () => {
    const writer = failWriter();
    const updates: string[] = [];
    const result = await buildSinglePassResult(singlePassArgs, writer.write, (u) =>
      updates.push(firstText(u)),
    );

    // Falls back to the full inline context (truncation-prone but a real review).
    expect(firstText(result)).toContain('# lens body');
    expect(firstText(result)).toContain('## Instructions');
    expect(result.details).not.toHaveProperty('contextFile');
    expect(updates.some((u) => u.includes('temp-file write failed'))).toBe(true);
  });
});

const validatedFinding: ValidatedFinding = {
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

const pipelineArgs = {
  pipeline: {
    findings: [validatedFinding],
    rejected: [],
    telemetry: telemetry({ buckets: 1, candidates: 1, validated: 1 }),
  },
  diff: diffSource,
  basePrompt: '## diff + lens context',
  lensNames: ['code-quality'],
  availableLenses: ['code-quality'],
  changedFiles: ['a.ts'],
};

describe('buildPipelineResult', () => {
  test('keeps findings inline and appends a pointer to the spilled context', async () => {
    const writer = okWriter();
    const result = await buildPipelineResult(pipelineArgs, writer.write);

    expect(writer.calls[0]).toBe('## diff + lens context');
    const text = firstText(result);
    expect(text).toContain('## Findings');
    expect(text).toContain('bug');
    expect(text).toContain('/tmp/pi-code-review-test.md');
    expect(result.details.findings).toEqual([validatedFinding]);
    expect(result.details.contextFile).toBe('/tmp/pi-code-review-test.md');
  });

  test('write failure still returns findings, just without a pointer', async () => {
    const writer = failWriter();
    const updates: string[] = [];
    const result = await buildPipelineResult(pipelineArgs, writer.write, (u) =>
      updates.push(firstText(u)),
    );

    const text = firstText(result);
    expect(text).toContain('## Findings');
    expect(text).toContain('bug');
    expect(text).not.toContain('/tmp/pi-code-review-test.md');
    expect(result.details.findings).toEqual([validatedFinding]);
    expect(result.details).not.toHaveProperty('contextFile');
    expect(updates.some((u) => u.includes('without diff pointer'))).toBe(true);
  });
});
