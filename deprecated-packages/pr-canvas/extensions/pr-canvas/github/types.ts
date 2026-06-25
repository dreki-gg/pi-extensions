/** Overview metadata from `gh pr view --json ...` */
export interface PrOverview {
  number: number;
  title: string;
  body: string;
  author: { login: string };
  state: string;
  labels: Array<{ name: string; color: string }>;
  reviewers: Array<{ login: string }>;
  baseRefName: string;
  headRefName: string;
  url: string;
  additions: number;
  deletions: number;
  createdAt: string;
  updatedAt: string;
}

/** A single file changed in the PR, parsed from the unified diff */
export interface PrFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  /** Raw unified diff patch for this file */
  patch: string;
}

/** A CI check from `gh pr checks --json ...` */
export interface PrCheck {
  name: string;
  /** e.g. SUCCESS, FAILURE, PENDING, STARTUP_FAILURE */
  state: string;
  description: string;
  detailsUrl: string;
}

/** A comment on the PR (top-level or inline) */
export interface PrComment {
  author: { login: string };
  body: string;
  createdAt: string;
  /** File path for inline review comments */
  path?: string;
  /** Line number for inline review comments */
  line?: number;
}

/** A review with its inline comments */
export interface PrReview {
  author: { login: string };
  /** APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING */
  state: string;
  body: string;
  createdAt: string;
  comments: PrComment[];
}

/** All data collected for a PR */
export interface PrData {
  overview: PrOverview;
  files: PrFile[];
  checks: PrCheck[];
  comments: PrComment[];
  reviews: PrReview[];
}
