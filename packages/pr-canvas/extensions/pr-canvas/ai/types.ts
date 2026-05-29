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
}

/** AI-generated summary of the PR */
export interface AiSummary {
  /** What the PR does */
  purpose: string;
  /** What areas/systems it affects */
  impact: string;
  /** Potential issues or things to watch for */
  concerns: string[];
  /** Notable or interesting changes worth highlighting */
  highlights: string[];
}
