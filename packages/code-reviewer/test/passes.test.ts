import { describe, expect, test } from 'bun:test';
import { Effect, Layer } from 'effect';

import { Reviewer, type ReviewerService } from '../extensions/code-reviewer/effects/model';
import { defaultModelPlan } from '../extensions/code-reviewer/model-plan';
import {
  bucketFindings,
  extractJsonArray,
  parseFindings,
  runPipelineEffect,
  selectCandidates,
  validateCandidatesEffect,
} from '../extensions/code-reviewer/passes';
import type {
  ModelPlan,
  RawFinding,
  ReviewPipelineConfig,
} from '../extensions/code-reviewer/types';

const PIPELINE: ReviewPipelineConfig = {
  passes: 4,
  validate: true,
  minVotes: 2,
  concurrency: 4,
  temperature: 0.4,
  maxFindings: 50,
  recordRejections: true,
};

const PLAN: ModelPlan = defaultModelPlan(PIPELINE.passes);

/** A fake Reviewer that replies based on the system prompt (pass vs validator)
 *  and an optional per-call script keyed by call index. */
function fakeReviewer(opts: {
  onPass?: (callIndex: number, modelKey: string) => string;
  onValidate?: (user: string, modelKey: string) => string;
  failPasses?: Set<number>;
  passModelKeys?: string[];
  validatorModelKey?: { value: string };
}) {
  let passCall = 0;
  const service: ReviewerService = {
    complete: (request) => {
      if (request.stage === 'validate') {
        if (opts.validatorModelKey) opts.validatorModelKey.value = request.modelKey;
        return Effect.succeed(
          opts.onValidate ? opts.onValidate(request.user, request.modelKey) : '[]',
        );
      }
      const index = passCall;
      passCall += 1;
      opts.passModelKeys?.push(request.modelKey);
      if (opts.failPasses?.has(index)) {
        return Effect.fail({
          _tag: 'ModelError',
          stage: request.stage,
          cause: new Error('boom'),
        } as never);
      }
      return Effect.succeed(opts.onPass ? opts.onPass(index, request.modelKey) : '[]');
    },
  };
  return Layer.succeed(Reviewer, service);
}

const NAN_BUG: RawFinding = {
  file: 'src/effect/lorebot-manifest.ts',
  line: 46,
  severity: 'warning',
  message:
    'readVersion uses typeof candidate === "number" which is true for NaN, so manifestVersion NaN is misreported as unsupported instead of falling through to ManifestDecodeFailed',
  category: 'boundary-input',
};

function findingsJson(findings: RawFinding[]): string {
  return JSON.stringify(findings);
}

describe('extractJsonArray', () => {
  test('pulls a balanced array out of prose and fences', () => {
    expect(extractJsonArray('here you go:\n```json\n[{"a":1}]\n```\nthanks')).toBe('[{"a":1}]');
    expect(extractJsonArray('noise [1, [2, 3], 4] tail')).toBe('[1, [2, 3], 4]');
    expect(extractJsonArray('a "]" inside [{"k":"]"}] end')).toBe('[{"k":"]"}]');
    expect(extractJsonArray('no array here')).toBeNull();
  });
});

describe('parseFindings', () => {
  test('keeps well-formed findings and drops malformed entries', () => {
    const text = JSON.stringify([
      NAN_BUG,
      { file: 'x.ts', severity: 'nope', message: 'bad severity' },
      { file: '', severity: 'warning', message: 'empty file' },
      { severity: 'note', message: 'no file' },
      { file: 'y.ts', line: -3, severity: 'note', message: 'bad line dropped to undefined' },
    ]);
    const findings = parseFindings(text);
    expect(findings).toHaveLength(2);
    expect(findings[0].message).toContain('NaN');
    expect(findings[1].line).toBeUndefined();
  });

  test('returns [] for non-array or garbage', () => {
    expect(parseFindings('not json')).toEqual([]);
    expect(parseFindings('{"file":"x"}')).toEqual([]);
  });
});

describe('bucketFindings + voting', () => {
  test('merges the same bug across passes and counts distinct votes', () => {
    const passA: RawFinding = { ...NAN_BUG };
    const passB: RawFinding = {
      ...NAN_BUG,
      line: 47,
      message:
        'typeof NaN is "number" so the version guard misclassifies NaN as an unsupported manifestVersion',
    };
    const unrelated: RawFinding = {
      file: 'src/other.ts',
      line: 10,
      severity: 'note',
      message: 'consider renaming this helper for clarity',
    };
    const buckets = bucketFindings([[passA], [passB], [unrelated]]);

    const nan = buckets.find((bucket) => bucket.file.includes('lorebot-manifest'));
    expect(nan?.votes).toBe(2);
    expect(nan?.severity).toBe('warning');
    // most detailed message survives
    expect(nan?.message.length).toBeGreaterThanOrEqual(NAN_BUG.message.length);
    expect(buckets).toHaveLength(2);
  });

  test('the same pass surfacing a bug twice counts as one vote', () => {
    const buckets = bucketFindings([[{ ...NAN_BUG }, { ...NAN_BUG, line: 45 }]]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].votes).toBe(1);
  });
});

describe('selectCandidates', () => {
  test('drops single-vote notes but keeps single-vote blockers/warnings', () => {
    const candidates = [
      { ...NAN_BUG, votes: 1, passIndices: [0] }, // warning, 1 vote → kept
      {
        file: 'a.ts',
        severity: 'note' as const,
        message: 'low signal note',
        votes: 1,
        passIndices: [0],
      },
      {
        file: 'b.ts',
        severity: 'note' as const,
        message: 'voted note',
        votes: 2,
        passIndices: [0, 1],
      },
    ];
    const { kept, droppedLowSignal } = selectCandidates(candidates, { minVotes: 2 });
    expect(droppedLowSignal).toBe(1);
    expect(kept.map((candidate) => candidate.file)).toEqual([
      'src/effect/lorebot-manifest.ts',
      'b.ts',
    ]);
  });
});

describe('validateCandidatesEffect', () => {
  const candidate = { ...NAN_BUG, votes: 3, passIndices: [0, 1, 2] };

  test('keeps real verdicts and drops false positives', async () => {
    const layer = fakeReviewer({
      onValidate: () =>
        JSON.stringify([
          { id: 0, verdict: 'real', confidence: 0.9, justification: 'NaN triggers it' },
        ]),
    });
    const out = await Effect.runPromise(
      validateCandidatesEffect('base', [candidate], PLAN, undefined).pipe(Effect.provide(layer)),
    );
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].confidence).toBe(0.9);
    expect(out.findings[0].models).toEqual(['default']);
    expect(out.droppedFalsePositives).toBe(0);

    const dropLayer = fakeReviewer({
      onValidate: () => JSON.stringify([{ id: 0, verdict: 'false-positive', confidence: 0.8 }]),
    });
    const dropped = await Effect.runPromise(
      validateCandidatesEffect('base', [candidate], PLAN, undefined).pipe(
        Effect.provide(dropLayer),
      ),
    );
    expect(dropped.findings).toHaveLength(0);
    expect(dropped.droppedFalsePositives).toBe(1);
  });

  test('fails OPEN — a validator error surfaces candidates unvalidated, never drops them', async () => {
    const layer = Layer.succeed(Reviewer, {
      complete: () =>
        Effect.fail({ _tag: 'ModelError', stage: 'validate', cause: new Error('x') } as never),
    });
    const out = await Effect.runPromise(
      validateCandidatesEffect('base', [candidate], PLAN, undefined).pipe(Effect.provide(layer)),
    );
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].justification).toContain('unvalidated');
  });
});

describe('runPipelineEffect (end to end with a fake model)', () => {
  test('the NaN bug found by 3/4 passes survives; a 1-pass false positive is dropped', async () => {
    const falsePositive: RawFinding = {
      file: 'src/safe.ts',
      line: 5,
      severity: 'warning',
      message: 'possible null deref on config object that is actually always initialized',
    };
    // passes 0,1,2 find the NaN bug; pass 1 also raises a lone false positive.
    const script = [
      findingsJson([NAN_BUG]),
      findingsJson([NAN_BUG, falsePositive]),
      findingsJson([NAN_BUG]),
      findingsJson([]),
    ];
    const layer = fakeReviewer({
      onPass: (index) => script[index],
      onValidate: (user) => {
        // The validator confirms the NaN bug, refutes the false positive.
        const verdicts: { id: number; verdict: string; confidence: number }[] = [];
        const lines = user.split('\n');
        for (const line of lines) {
          const match = line.match(/^\[(\d+)\]/);
          if (!match) continue;
          const id = Number(match[1]);
          verdicts.push(
            line.includes('lorebot-manifest')
              ? { id, verdict: 'real', confidence: 0.95 }
              : { id, verdict: 'false-positive', confidence: 0.7 },
          );
        }
        return JSON.stringify(verdicts);
      },
    });

    const result = await Effect.runPromise(
      runPipelineEffect('base prompt', PIPELINE, PLAN, {}, undefined).pipe(Effect.provide(layer)),
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toContain('lorebot-manifest');
    expect(result.findings[0].votes).toBe(3);
    expect(result.telemetry.passFindingCounts).toEqual([1, 2, 1, 0]);
    // false positive reached the validator (warning, 1 vote is kept pre-validation) then dropped
    expect(result.telemetry.droppedFalsePositives).toBe(1);
  });

  test('a degraded pass does not sink the run (failedPasses counted)', async () => {
    const layer = fakeReviewer({
      onPass: () => findingsJson([NAN_BUG]),
      onValidate: () => JSON.stringify([{ id: 0, verdict: 'real', confidence: 0.9 }]),
      failPasses: new Set([2]),
    });
    const result = await Effect.runPromise(
      runPipelineEffect('base', PIPELINE, PLAN, {}, undefined).pipe(Effect.provide(layer)),
    );
    expect(result.telemetry.failedPasses).toBe(1);
    expect(result.findings).toHaveLength(1);
  });

  test('captures a sample error message when passes fail (telemetry, not silent 0)', async () => {
    const layer = fakeReviewer({
      onPass: () => findingsJson([NAN_BUG]),
      onValidate: () => JSON.stringify([{ id: 0, verdict: 'real', confidence: 0.9 }]),
      failPasses: new Set([0, 1, 2, 3]),
    });
    const result = await Effect.runPromise(
      runPipelineEffect('base', PIPELINE, PLAN, {}, undefined).pipe(Effect.provide(layer)),
    );
    expect(result.telemetry.failedPasses).toBe(4);
    expect(result.telemetry.passErrorSample).toContain('boom');
    expect(result.findings).toHaveLength(0);
  });

  test('validate:false ranks by votes without a validator call', async () => {
    const layer = fakeReviewer({ onPass: () => findingsJson([NAN_BUG]) });
    const result = await Effect.runPromise(
      runPipelineEffect('base', { ...PIPELINE, validate: false }, PLAN, {}, undefined).pipe(
        Effect.provide(layer),
      ),
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].confidence).toBeCloseTo(1, 5); // 4/4 votes
  });

  test('model bake-off: passes route to their assigned models and findings carry attribution', async () => {
    // Rotate two models across 4 passes; validator on a third. Each pass finds
    // the NaN bug, so the merged finding should aggregate both pass models.
    const plan: ModelPlan = {
      passes: [
        { key: 'model-a', label: 'model-a' },
        { key: 'model-b', label: 'model-b' },
        { key: 'model-a', label: 'model-a' },
        { key: 'model-b', label: 'model-b' },
      ],
      validator: { key: 'model-c', label: 'model-c' },
    };
    const passModelKeys: string[] = [];
    const validatorModelKey = { value: '' };
    const layer = fakeReviewer({
      onPass: () => findingsJson([NAN_BUG]),
      onValidate: () => JSON.stringify([{ id: 0, verdict: 'real', confidence: 0.9 }]),
      passModelKeys,
      validatorModelKey,
    });

    const result = await Effect.runPromise(
      runPipelineEffect('base', PIPELINE, plan, {}, undefined).pipe(Effect.provide(layer)),
    );

    expect(passModelKeys).toEqual(['model-a', 'model-b', 'model-a', 'model-b']);
    expect(validatorModelKey.value).toBe('model-c');
    expect(result.telemetry.passModels).toEqual(['model-a', 'model-b', 'model-a', 'model-b']);
    expect(result.telemetry.validatorModel).toBe('model-c');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].models).toEqual(['model-a', 'model-b']);
  });
});
