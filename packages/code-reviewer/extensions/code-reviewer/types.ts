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
};
