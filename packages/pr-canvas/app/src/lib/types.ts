// ── PR Data Types (mirror of extension types for the client) ───────────

export interface PrAuthor {
  login: string;
}

export interface PrLabel {
  name: string;
  color: string;
}

export interface PrOverview {
  number: number;
  title: string;
  body: string;
  author: PrAuthor;
  state: string;
  labels: PrLabel[];
  reviewers: Array<{ login: string }>;
  baseRefName: string;
  headRefName: string;
  url: string;
  additions: number;
  deletions: number;
  createdAt: string;
  updatedAt: string;
}

export interface PrFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
}

export interface PrCheck {
  name: string;
  state: string;
  description: string;
  detailsUrl: string;
}

export interface PrComment {
  author: PrAuthor;
  body: string;
  createdAt: string;
  path?: string;
  line?: number;
}

export interface PrReview {
  author: PrAuthor;
  state: string;
  body: string;
  createdAt: string;
  comments: PrComment[];
}

export interface PrData {
  overview: PrOverview;
  files: PrFile[];
  checks: PrCheck[];
  comments: PrComment[];
  reviews: PrReview[];
}

export interface MindMapGroup {
  label: string;
  description: string;
  files: string[];
  changeType: 'feature' | 'refactor' | 'fix' | 'test' | 'config' | 'docs' | 'other';
}

export interface AiSummary {
  purpose: string;
  impact: string;
  concerns: string[];
  highlights: string[];
}

export interface PrListItem {
  number: number;
  title: string;
  author: PrAuthor;
  state: string;
  url: string;
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── WebSocket Message Types ────────────────────────────────────────────

export type WsMessageToServer =
  | { type: 'pr:list' }
  | { type: 'pr:data'; number: number }
  | { type: 'pr:subscribe'; number: number }
  | { type: 'ai:chat'; message: string; prNumber: number };

export type WsMessageFromServer =
  | { type: 'pr:list:result'; prs: PrListItem[] }
  | {
      type: 'pr:data:result';
      number: number;
      data: PrData;
      rawDiff: string;
      mindMap: MindMapGroup[];
      aiSummary: AiSummary;
    }
  | { type: 'pr:update'; number: number; data: PrData }
  | { type: 'ai:chat:response'; message: string }
  | { type: 'ai:chat:stream'; chunk: string; done?: boolean }
  | { type: 'error'; message: string };

export interface FullPrData {
  number: number;
  data: PrData;
  rawDiff: string;
  mindMap: MindMapGroup[];
  aiSummary: AiSummary;
}
