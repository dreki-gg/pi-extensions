/** A callable or user-facing surface introduced/changed by the PR. */
export interface ReviewSurface {
  method: string;
  path: string;
  auth: string;
  requestShape: string;
  responseShape: string;
  change: 'NEW' | 'CHANGED';
  source?: string;
}

/** A field on a changed/new data structure. */
export interface ReviewDataField {
  name: string;
  type: string;
  required: string;
  description: string;
}

/** A new or changed persisted/serialized/exported data structure. */
export interface ReviewDataStructure {
  name: string;
  source: string;
  fields: ReviewDataField[];
}

/** Source reference extracted from diff hunks when possible. */
export interface SourceReference {
  path: string;
  range: string;
  reason: string;
}

/** A semantic group of related file changes */
export interface MindMapGroup {
  /** Human-readable label, e.g. "Auth refactor" */
  label: string;
  /** Brief description of what this group of changes does */
  description: string;
  /** File paths belonging to this group */
  files: string[];
  /** High-level category for the change */
  changeType: 'feature' | 'refactor' | 'fix' | 'test' | 'config' | 'docs' | 'other';
  /** Optional Mermaid diagram describing the relationship/data flow for this group. */
  diagram?: string;
  /** Relationship bullets that explain why these files belong together. */
  relationships?: string[];
}

/** AI-generated or deterministic architecture-review summary of the PR */
export interface AiSummary {
  /** What the PR does (legacy field kept for existing renderers) */
  purpose: string;
  /** What areas/systems it affects (legacy field kept for existing renderers) */
  impact: string;
  /** Potential issues or things to watch for (legacy field kept for existing renderers) */
  concerns: string[];
  /** Notable or interesting changes worth highlighting (legacy field kept for existing renderers) */
  highlights: string[];
  /** Architecture-doc style one-paragraph summary. */
  tldr?: string;
  /** Specific deltas, ideally with source references. */
  whatChanged?: string[];
  /** Brief system/data-flow bullets. */
  systemFlow?: string[];
  /** New/changed callable or integration surfaces. */
  endpoints?: ReviewSurface[];
  /** New/changed data structures. */
  dataStructures?: ReviewDataStructure[];
  /** Review hot-spots scoped to the changed risk surface. */
  hotSpots?: string[];
  /** Specific unanswered questions for reviewers. */
  openQuestions?: string[];
  /** File/range references supporting the summary. */
  sourceReferences?: SourceReference[];
  /** Whether this was produced by the AI boundary or deterministic fallback. */
  generatedBy?: 'ai' | 'heuristic';
}

export interface ReviewIntelligence {
  summary: AiSummary;
  mindMap: MindMapGroup[];
}
