/**
 * Self-driving review pipeline (Bugbot-style).
 *
 * Instead of returning a prompt for a single downstream pass, the tool can run
 * the review itself: fan out several ADVERSARIAL bug-finding passes over the
 * session's model, bucket near-duplicate findings, keep the ones multiple
 * passes independently surface (majority vote), then run a VALIDATOR pass that
 * tries to falsify each survivor. This mirrors the structure Cursor describes
 * for Bugbot (parallel passes with varied reasoning → bucket → vote → validate)
 * and exists specifically to catch the class of bug a single checklist pass
 * misses — e.g. `typeof NaN === 'number'` slipping a boundary guard.
 *
 * Everything here is pure over the {@link Reviewer} service so it is unit
 * testable with a deterministic fake model.
 */

import { Effect } from 'effect';

import { causeMessage } from './errors';
import { sameBug, tokenize } from './similarity';
import { type ModelResolution, Reviewer, makeReviewerService } from './effects/model';
import type {
  CandidateFinding,
  LensSeverity,
  ModelPlan,
  PipelineResult,
  PipelineTelemetry,
  RawFinding,
  ReviewPipelineConfig,
  ValidatedFinding,
} from './types';

const SEVERITY_RANK: Record<LensSeverity, number> = { blocker: 3, warning: 2, note: 1 };
const VALID_SEVERITIES = new Set<LensSeverity>(['blocker', 'warning', 'note']);

/** Adversarial system prompt shared by every bug-finding pass. Intentionally
 *  aggressive: Bugbot found that cautious prompts under-report, and a separate
 *  validator stage is cheaper than missed bugs. */
const PASS_SYSTEM_PROMPT = [
  'You are an aggressive, adversarial code reviewer hunting for REAL bugs in a diff —',
  'logic errors, data loss/corruption, security holes, and correctness defects. Not style, not nits.',
  '',
  'Method — be suspicious of EVERY changed line:',
  '- For each changed function, enumerate adversarial inputs and ask what breaks:',
  '  null / undefined / NaN / Infinity / -0 / "" / [] / {} / huge / negative / duplicate / out-of-order / unicode.',
  '- Audit every comment and test claim against the ACTUAL code. If a comment says "non-numeric falls through",',
  '  construct the exact input that proves it does NOT (e.g. `typeof NaN === "number"` defeats a typeof guard).',
  '- Hunt specifically for: off-by-one; wrong id/key space; missing await / unhandled rejection; swallowed errors;',
  '  race conditions & cancellation; type-narrowing escapes & unsafe casts; boundary/edge conditions;',
  '  lost writes (in-memory/UI updated but never durably persisted); injection / path-traversal / zip-slip;',
  '  resource leaks & unbounded loops; contract drift between a producer and its consumer.',
  '- Use the provided lens definitions as project-specific invariants to check.',
  '',
  'Prefer flagging a suspicious pattern over staying silent — a validator filters false positives later.',
  'Report a bug at the precise file and line it occurs.',
  '',
  'Output ONLY a JSON array, no prose, no markdown fences:',
  '[{ "file": "path", "line": 42, "severity": "blocker|warning|note", "category": "short-tag", "message": "what + why + the triggering input" }]',
].join('\n');

/** Per-pass focus seeds. Giving each pass a different lens of suspicion (and a
 *  temperature jitter) diversifies reasoning the way Bugbot's randomized diff
 *  ordering does, so passes don't collapse onto identical findings. */
export const PASS_FOCUSES = [
  'TRUST BOUNDARIES & INPUT VALIDATION: every value crossing an external/disk/wire/user boundary; every decode/parse; the edge inputs (null/undefined/NaN/Infinity/-0/empty/huge/negative). Numeric-type guards that `NaN`/`Infinity` defeat.',
  'CONTROL FLOW & BRANCHES: every new conditional, guard, early return, and switch — find the missed case, the inverted condition, and the off-by-one.',
  'ASYNC LIFECYCLE & CONCURRENCY: await ordering, missing await, unhandled rejection, fire-and-forget, races, cancellation/abort handling, stale writes after unmount/navigation.',
  'TYPES & INVARIANTS: type-narrowing escapes, unsafe casts, non-null assertions on absent values, non-exhaustive unions, and any comment/test claim that the code does not actually honor.',
  'STATE & DATA INTEGRITY: in-memory or UI mutation with no matching durable write (lost on reload), wrong id/key space in a lookup, a projection clobbering the source of truth, read-before-write ordering.',
  'ERROR HANDLING & SECURITY: swallowed/empty catches, leaked secrets, injection, path traversal / zip-slip, trusting unsanitized external data, missing validation before a side effect.',
  'RESOURCE & PERFORMANCE: unbounded loops/polls, N+1 IO, memory leaks, missing cleanup of timers/listeners/streams.',
  'CONTRACT & COMPATIBILITY: signature/shape drift, breaking changes to a wire/format contract, mismatched assumptions between a producer and its consumer, version negotiation gaps.',
] as const;

const VALIDATOR_SYSTEM_PROMPT = [
  'You are a STRICT bug validator. You receive a diff and a numbered list of candidate findings from several reviewers.',
  'For EACH candidate decide: is it a REAL bug actually present in / introduced by this diff, or a FALSE POSITIVE?',
  '',
  'Rules:',
  '- To mark "real" you must be able to name the concrete input or execution path that triggers it, grounded in the shown code.',
  '- Mark "false-positive" for speculation unsupported by the diff, style nitpicks, behavior already handled by the shown code, or duplicates of another candidate.',
  '- Be conservative: if you cannot substantiate a candidate from the diff, it is a false positive.',
  '- Keep justification to one or two sentences naming the trigger (for real) or the reason it cannot occur (for false-positive).',
  '',
  'Output ONLY a JSON array, no prose, no fences:',
  '[{ "id": 0, "verdict": "real|false-positive", "confidence": 0.0, "justification": "..." }]',
].join('\n');


type WorkingBucket = {
  file: string;
  line?: number;
  tokens: Set<string>;
  severities: LensSeverity[];
  messages: string[];
  categories: (string | undefined)[];
  passIndices: Set<number>;
};

/** Extract the first balanced top-level JSON array from arbitrary model text,
 *  tolerating prose or ```json fences around it. */
export function extractJsonArray(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const haystack = fenced ? fenced[1] : text;
  const start = haystack.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < haystack.length; index += 1) {
    const char = haystack[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return haystack.slice(start, index + 1);
    }
  }
  return null;
}

function coerceSeverity(value: unknown): LensSeverity | null {
  return typeof value === 'string' && VALID_SEVERITIES.has(value as LensSeverity)
    ? (value as LensSeverity)
    : null;
}

/** Parse one pass's raw text into validated RawFindings, dropping junk. */
export function parseFindings(text: string): RawFinding[] {
  const json = extractJsonArray(text);
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const findings: RawFinding[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const severity = coerceSeverity(record.severity);
    const file = typeof record.file === 'string' ? record.file.trim() : '';
    const message = typeof record.message === 'string' ? record.message.trim() : '';
    if (!severity || !file || !message) continue;
    const line =
      typeof record.line === 'number' && Number.isInteger(record.line) && record.line > 0
        ? record.line
        : undefined;
    const category = typeof record.category === 'string' ? record.category.trim() : undefined;
    findings.push({ file, line, severity, message, category });
  }
  return findings;
}

/** Bucket near-duplicate findings across all passes, tracking distinct votes. */
export function bucketFindings(perPass: RawFinding[][]): CandidateFinding[] {
  const buckets: WorkingBucket[] = [];

  perPass.forEach((findings, passIndex) => {
    for (const finding of findings) {
      const tokens = tokenize(finding.message);
      const match = buckets.find((bucket) => sameBug({ ...finding, tokens }, bucket));
      if (match) {
        match.severities.push(finding.severity);
        match.messages.push(finding.message);
        match.categories.push(finding.category);
        match.passIndices.add(passIndex);
        // Tighten the bucket line toward the most specific (defined) value.
        if (match.line === undefined && finding.line !== undefined) match.line = finding.line;
        for (const token of tokens) match.tokens.add(token);
      } else {
        buckets.push({
          file: finding.file,
          line: finding.line,
          tokens,
          severities: [finding.severity],
          messages: [finding.message],
          categories: [finding.category],
          passIndices: new Set([passIndex]),
        });
      }
    }
  });

  return buckets.map(mergeBucket);
}

/** Collapse a bucket to one representative finding: highest severity wins, the
 *  most detailed message survives, votes = distinct contributing passes. */
function mergeBucket(bucket: WorkingBucket): CandidateFinding {
  const severity = bucket.severities.reduce((best, current) =>
    SEVERITY_RANK[current] > SEVERITY_RANK[best] ? current : best,
  );
  const message = bucket.messages.reduce((best, current) =>
    current.length > best.length ? current : best,
  );
  const category = mostCommon(bucket.categories.filter((value): value is string => Boolean(value)));
  const passIndices = [...bucket.passIndices].sort((left, right) => left - right);
  return {
    file: bucket.file,
    line: bucket.line,
    severity,
    message,
    category,
    votes: passIndices.length,
    passIndices,
  };
}

function mostCommon(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

/** Drop low-signal NOTE buckets (single-pass noise); always keep blockers and
 *  warnings so a genuine high-severity singleton still reaches the validator. */
export function selectCandidates(
  candidates: CandidateFinding[],
  config: Pick<ReviewPipelineConfig, 'minVotes'>,
): { kept: CandidateFinding[]; droppedLowSignal: number } {
  const kept = candidates.filter(
    (candidate) => candidate.severity !== 'note' || candidate.votes >= config.minVotes,
  );
  return { kept, droppedLowSignal: candidates.length - kept.length };
}

function severitySort(left: ValidatedFinding, right: ValidatedFinding): number {
  const bySeverity = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
  if (bySeverity !== 0) return bySeverity;
  if (right.votes !== left.votes) return right.votes - left.votes;
  return right.confidence - left.confidence;
}

// ── Pipeline stages (Effect over the Reviewer service) ───────────────────────

function buildPassUser(basePrompt: string, focus: string): string {
  return [
    basePrompt,
    '',
    '---',
    `PASS FOCUS (weight your attention here, but report any bug you see): ${focus}`,
    '',
    'Return ONLY the JSON array of findings described in your instructions.',
  ].join('\n');
}

/** Distinct model labels behind a finding's contributing passes (attribution). */
function contributingModels(passIndices: number[], plan: ModelPlan): string[] {
  return [...new Set(passIndices.map((index) => plan.passes[index]?.label).filter(Boolean))];
}

/** Run N adversarial passes concurrently; a failed pass degrades to []. Each
 *  pass runs on the model + reasoning named by `plan.passes[passIndex]`. */
export function runPassesEffect(
  basePrompt: string,
  config: ReviewPipelineConfig,
  plan: ModelPlan,
  signal?: AbortSignal,
): Effect.Effect<
  { perPass: RawFinding[][]; failedPasses: number; passErrorSample?: string },
  never,
  Reviewer
> {
  return Effect.gen(function* () {
    const reviewer = yield* Reviewer;
    const indices = Array.from({ length: config.passes }, (_unused, index) => index);

    const outcomes = yield* Effect.forEach(
      indices,
      (passIndex) =>
        Effect.gen(function* () {
          const focus = PASS_FOCUSES[passIndex % PASS_FOCUSES.length];
          const assignment = plan.passes[passIndex];
          // Deterministic per-pass jitter so reruns are stable but passes differ.
          const temperature = config.temperature + (passIndex % 4) * 0.1;
          const result = yield* reviewer
            .complete({
              modelKey: assignment.key,
              reasoning: assignment.reasoning,
              system: PASS_SYSTEM_PROMPT,
              user: buildPassUser(basePrompt, focus),
              temperature,
              stage: `pass-${passIndex + 1}`,
              signal,
            })
            .pipe(Effect.either);
          return result._tag === 'Right'
            ? { findings: parseFindings(result.right), failed: false, error: undefined }
            : { findings: [] as RawFinding[], failed: true, error: describePassError(result.left) };
        }),
      { concurrency: Math.max(1, config.concurrency) },
    );

    const failures = outcomes.filter((outcome) => outcome.failed);
    return {
      perPass: outcomes.map((outcome) => outcome.findings),
      failedPasses: failures.length,
      passErrorSample: failures[0]?.error,
    };
  });
}

/** Best-effort human message for a failed pass: the ModelError's own message
 *  when present, else its underlying cause. */
function describePassError(error: unknown): string {
  const message = (error as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  return causeMessage((error as { cause?: unknown }).cause);
}

function buildValidatorUser(basePrompt: string, candidates: CandidateFinding[]): string {
  const list = candidates
    .map((candidate, index) => {
      const where = candidate.line ? `${candidate.file}:${candidate.line}` : candidate.file;
      return `[${index}] (${candidate.severity}, ${candidate.votes} votes) ${where} — ${candidate.message}`;
    })
    .join('\n');
  return [
    basePrompt,
    '',
    '---',
    'CANDIDATE FINDINGS TO VALIDATE:',
    list,
    '',
    'For each candidate id above, output the verdict JSON described in your instructions.',
  ].join('\n');
}

type Verdict = {
  id: number;
  verdict: 'real' | 'false-positive';
  confidence: number;
  justification?: string;
};

function parseVerdicts(text: string): Map<number, Verdict> {
  const json = extractJsonArray(text);
  const verdicts = new Map<number, Verdict>();
  if (!json) return verdicts;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return verdicts;
  }
  if (!Array.isArray(parsed)) return verdicts;
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== 'number' || !Number.isInteger(record.id)) continue;
    const verdict = record.verdict === 'real' ? 'real' : 'false-positive';
    const confidence =
      typeof record.confidence === 'number' && Number.isFinite(record.confidence)
        ? Math.min(1, Math.max(0, record.confidence))
        : 0.5;
    const justification =
      typeof record.justification === 'string' ? record.justification.trim() : undefined;
    verdicts.set(record.id, { id: record.id, verdict, confidence, justification });
  }
  return verdicts;
}

/** Validate every candidate in one batched call; survivors are verdict=real.
 *  A validator failure fails OPEN (keep candidates, unvalidated) so a flaky
 *  model never silently drops real bugs. */
export function validateCandidatesEffect(
  basePrompt: string,
  candidates: CandidateFinding[],
  plan: ModelPlan,
  signal?: AbortSignal,
): Effect.Effect<
  { findings: ValidatedFinding[]; droppedFalsePositives: number; rejected: CandidateFinding[] },
  never,
  Reviewer
> {
  return Effect.gen(function* () {
    if (candidates.length === 0) return { findings: [], droppedFalsePositives: 0, rejected: [] };
    const reviewer = yield* Reviewer;

    const result = yield* reviewer
      .complete({
        modelKey: plan.validator.key,
        reasoning: plan.validator.reasoning,
        system: VALIDATOR_SYSTEM_PROMPT,
        user: buildValidatorUser(basePrompt, candidates),
        temperature: 0,
        stage: 'validate',
        signal,
      })
      .pipe(Effect.either);

    if (result._tag === 'Left') {
      // Fail open: surface candidates unvalidated rather than lose them.
      const findings = candidates.map((candidate) => ({
        ...candidate,
        verdict: 'real' as const,
        confidence: 0.5,
        justification: '(validator unavailable — surfaced unvalidated)',
        models: contributingModels(candidate.passIndices, plan),
      }));
      return { findings, droppedFalsePositives: 0, rejected: [] };
    }

    const verdicts = parseVerdicts(result.right);
    const findings: ValidatedFinding[] = [];
    const rejected: CandidateFinding[] = [];
    candidates.forEach((candidate, index) => {
      const verdict = verdicts.get(index);
      // A candidate with no verdict returned is kept (fail open), not dropped.
      if (verdict && verdict.verdict === 'false-positive') {
        rejected.push(candidate);
        return;
      }
      findings.push({
        ...candidate,
        verdict: 'real',
        confidence: verdict?.confidence ?? 0.5,
        justification: verdict?.justification,
        models: contributingModels(candidate.passIndices, plan),
      });
    });
    return { findings, droppedFalsePositives: rejected.length, rejected };
  });
}

/** Full pipeline: passes → bucket → vote → (validate) → ranked, capped result. */
export function runPipelineEffect(
  basePrompt: string,
  config: ReviewPipelineConfig,
  plan: ModelPlan,
  hooks: { onStage?: (stage: string) => void } = {},
  signal?: AbortSignal,
): Effect.Effect<PipelineResult, never, Reviewer> {
  return Effect.gen(function* () {
    hooks.onStage?.(`running ${config.passes} passes`);
    const { perPass, failedPasses, passErrorSample } = yield* runPassesEffect(
      basePrompt,
      config,
      plan,
      signal,
    );

    const buckets = bucketFindings(perPass);
    const { kept, droppedLowSignal } = selectCandidates(buckets, config);

    let validated: ValidatedFinding[];
    let droppedFalsePositives = 0;
    let rejected: CandidateFinding[] = [];
    if (config.validate) {
      hooks.onStage?.(`validating ${kept.length} candidates`);
      const outcome = yield* validateCandidatesEffect(basePrompt, kept, plan, signal);
      validated = outcome.findings;
      droppedFalsePositives = outcome.droppedFalsePositives;
      rejected = outcome.rejected;
    } else {
      validated = kept.map((candidate) => ({
        ...candidate,
        verdict: 'real' as const,
        confidence: Math.min(1, candidate.votes / Math.max(1, config.passes)),
        models: contributingModels(candidate.passIndices, plan),
      }));
    }

    validated.sort(severitySort);
    const capped = validated.slice(0, config.maxFindings);

    const telemetry: PipelineTelemetry = {
      passes: config.passes,
      passFindingCounts: perPass.map((findings) => findings.length),
      buckets: buckets.length,
      candidates: kept.length,
      validated: capped.length,
      droppedFalsePositives,
      droppedLowSignal,
      failedPasses,
      passErrorSample,
      passModels: plan.passes.map((assignment) => assignment.label),
      validatorModel: plan.validator.label,
    };
    return { findings: capped, rejected, telemetry };
  });
}

/** Promise wrapper: run the full pipeline against a resolved set of models. */
export function runPipeline(
  resolution: ModelResolution,
  plan: ModelPlan,
  basePrompt: string,
  config: ReviewPipelineConfig,
  hooks: { onStage?: (stage: string) => void } = {},
  signal?: AbortSignal,
): Promise<PipelineResult> {
  return Effect.runPromise(
    runPipelineEffect(basePrompt, config, plan, hooks, signal).pipe(
      Effect.provideService(Reviewer, makeReviewerService(resolution)),
    ),
  );
}
