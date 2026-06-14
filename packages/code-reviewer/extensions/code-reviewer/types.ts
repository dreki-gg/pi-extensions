export type LensSeverity = 'blocker' | 'warning' | 'note';

export type LensFinding = {
  file: string;
  line?: number;
  severity: LensSeverity;
  message: string;
};

export type LensConfig = {
  name: string;
  description: string;
  criteria: string;
  tools: string[];
  severityRules: Record<LensSeverity, string>;
};

export type LensResult = {
  lens: string;
  findings: LensFinding[];
  summary: string;
  toolOutputs?: Record<string, string>;
  /** Lens-specific prompt section (without the diff), assembled by the command
   *  layer with a single shared diff to avoid per-lens duplication. */
  _lensSection?: string;
};

// ── Self-driving review pipeline (Bugbot-style) ──────────────────────────────
//
// The tool can run the review itself by driving the session's model through
// several parallel adversarial passes, bucketing + majority-voting the
// findings, then validating each survivor — instead of returning a prompt for
// a single downstream pass. The types below describe that pipeline's data.

/** A finding as emitted by one bug-finding pass (before bucketing). */
export type RawFinding = {
  file: string;
  line?: number;
  severity: LensSeverity;
  message: string;
  /** Optional bug taxonomy tag the pass assigned (e.g. "boundary-input"). */
  category?: string;
};

/** A merged bucket of near-duplicate raw findings across passes. */
export type CandidateFinding = RawFinding & {
  /** Number of DISTINCT passes that independently surfaced this bucket. */
  votes: number;
  /** Indices of the passes that contributed (0-based). */
  passIndices: number[];
};

/** A candidate after the validator stage has confirmed or refuted it. */
export type ValidatedFinding = CandidateFinding & {
  verdict: 'real' | 'false-positive';
  /** Validator confidence in `verdict`, 0..1. */
  confidence: number;
  justification?: string;
  /** True when this finding matches a previously-recorded rejection. Downranked
   *  and tagged in the report; never hidden. */
  previouslyRejected?: boolean;
  /** Distinct model keys whose passes contributed to this finding (for the
   *  model bake-off: "which model caught this"). */
  models: string[];
};

/** Reasoning/thinking effort for a step (mirrors pi-ai's `ThinkingLevel`). */
export type ReasoningLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** A per-step model choice in config: either a bare spec string
 *  ("provider/id", id, or name) or that spec plus a reasoning level. */
export type ModelSpec = { model: string; reasoning?: ReasoningLevel };
export type ModelStepConfig = string | ModelSpec;

/** A resolved per-step assignment the pipeline runs against. `key` is either
 *  {@link DEFAULT_MODEL_KEY} (the session model) or a spec that resolved to a
 *  real model; `label` is the human display (key + reasoning). */
export type ModelAssignment = {
  key: string;
  label: string;
  reasoning?: ReasoningLevel;
};

export type ModelPlan = {
  /** Assignment for each pass, length === `passes` (round-robin from config). */
  passes: ModelAssignment[];
  /** Assignment for the validator stage. */
  validator: ModelAssignment;
};

/** Counts describing what the pipeline did, for transparency in the report. */
export type PipelineTelemetry = {
  passes: number;
  passFindingCounts: number[];
  buckets: number;
  candidates: number;
  validated: number;
  droppedFalsePositives: number;
  droppedLowSignal: number;
  failedPasses: number;
  /** A representative error message from the first failed pass, surfaced so a
   *  fully-failed run reports WHY instead of a misleading "0 findings". */
  passErrorSample?: string;
  /** Model key used for each pass (parallel to pass index). */
  passModels: string[];
  /** Model key used for the validator stage. */
  validatorModel: string;
};

export type PipelineResult = {
  findings: ValidatedFinding[];
  /** Candidates the validator refuted this run. Surfaced (not just counted) so
   *  the command layer can persist them as recorded rejections. */
  rejected: CandidateFinding[];
  telemetry: PipelineTelemetry;
};

/** A persisted record of a validator-refuted finding, matched against future
 *  runs so a refuted finding that resurfaces is downranked and tagged. */
export type RejectionRecord = {
  file: string;
  line?: number;
  severity: LensSeverity;
  message: string;
  justification?: string;
  /** ISO timestamp the rejection was recorded. */
  recorded_at: string;
};

/** Tunables for the self-driving pipeline (all overridable in config). */
export type ReviewPipelineConfig = {
  /** Parallel adversarial bug-finding passes. 0 disables the pipeline
   *  (falls back to returning a single-pass review prompt). */
  passes: number;
  /** Run the validator stage that falsifies each surviving candidate. */
  validate: boolean;
  /** Min distinct passes a NOTE-severity bucket needs to survive pre-validation
   *  (blockers/warnings are never dropped for low votes). */
  minVotes: number;
  /** Max passes run concurrently. */
  concurrency: number;
  /** Base sampling temperature; each pass adds a small deterministic jitter so
   *  passes diverge instead of collapsing onto identical reasoning. */
  temperature: number;
  /** Hard cap on findings returned (safety valve against runaway output). */
  maxFindings: number;
  /** Persist validator false-positives and downrank+tag matches on later runs. */
  recordRejections: boolean;
  /** Model for ALL passes — a spec string or `{ model, reasoning }`. Omitted →
   *  session model. Overridden per-pass by {@link passModels}. */
  passModel?: ModelStepConfig;
  /** Models rotated round-robin across passes — run the same diff through
   *  several models/reasoning levels in one review (a bake-off). Overrides
   *  `passModel`. */
  passModels?: ModelStepConfig[];
  /** Model for the validator stage — a spec string or `{ model, reasoning }`.
   *  Omitted → session model. */
  validateModel?: ModelStepConfig;
};

// NOTE: findings + summary on LensResult describe what the agent produces in
// its follow-up message; the tool/command layer emits a review *task*, it does
// not parse findings back into a rendered report.

export type ReviewConfig = {
  lensDir: string;
  defaultLenses: string[];
  /** Per-tool wall-clock timeout in ms. A lens tool that exceeds it is killed
   *  and reported as timed-out (it must never hang the review). */
  toolTimeoutMs: number;
  /** Max lens tools run in parallel. Tools are deduped across lenses first,
   *  so this bounds the distinct command set, not lens count. */
  toolConcurrency: number;
  /** Self-driving pipeline tunables (see {@link ReviewPipelineConfig}). */
  review: ReviewPipelineConfig;
  /** Path (relative to cwd) of the recorded-rejections JSONL store. */
  rejectionsFile: string;
};
