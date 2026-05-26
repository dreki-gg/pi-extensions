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
  /** Review prompt built for this lens, used internally to delegate to the agent. */
  _prompt?: string;
  /** Lens-specific section (without diff), used by /review command to avoid diff duplication. */
  _lensSection?: string;
};

export type ReviewConfig = {
  lensDir: string;
  defaultLenses: string[];
};

export type ReviewReport = {
  diff: string;
  diffStat: string;
  lenses: LensResult[];
  generatedAt: string;
};
