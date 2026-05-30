import type { PrData } from '../github/types';
import type { AiSummary, MindMapGroup } from './types';

export const MAX_REVIEW_DIFF_CHARS = 60_000;
export const MAX_CHAT_DIFF_CHARS = 80_000;

export interface PrIntelligenceSnapshot {
  prData: PrData;
  rawDiff: string;
  aiSummary?: AiSummary;
  mindMap?: MindMapGroup[];
}

export function buildReviewPrompt(pr: PrData): string {
  return `You are PR Canvas architecture-review synthesis. Return strict JSON only with {"summary": AiSummary, "mindMap": MindMapGroup[]}.

Use the arch-doc-bot style: TL;DR, what changed, system/data flow, endpoints/surfaces, data structures, review hot-spots, open questions. Keep it under 600 words. Use line refs when supplied by the diff context. Mermaid diagrams must be brief and valid: avoid semicolons in sequenceDiagram messages, quote risky labels, no HTML.

PR #${pr.overview.number}: ${pr.overview.title}`;
}

export function buildReviewContext(
  pr: PrData,
  rawDiff: string,
  maxDiffChars = MAX_REVIEW_DIFF_CHARS,
): string {
  const compactFiles = pr.files.map((file) => `${file.status} ${file.path} +${file.additions}/-${file.deletions}`).join('\n');
  return [
    `Title: ${pr.overview.title}`,
    `Body:\n${pr.overview.body || '(empty)'}`,
    `Files:\n${compactFiles}`,
    `Checks:\n${pr.checks.map((check) => `${check.state} ${check.name}: ${check.description}`).join('\n') || '(none)'}`,
    `Comments:\n${pr.comments.map((comment) => `${comment.author.login}: ${comment.body}`).join('\n') || '(none)'}`,
    `Reviews:\n${pr.reviews.map((review) => `${review.author.login} ${review.state}: ${review.body}`).join('\n') || '(none)'}`,
    `Unified diff:\n${truncate(rawDiff, maxDiffChars)}`,
  ].join('\n\n');
}

export function buildChatPrompt(question: string): string {
  return `Answer the user's question about this pull request using only the provided PR context. Be concise, cite file paths or line refs when available, and say when the context does not contain enough information.\n\nQuestion: ${question}`;
}

export function buildChatContext(
  snapshot: PrIntelligenceSnapshot,
  maxDiffChars = MAX_CHAT_DIFF_CHARS,
): string {
  const { prData: pr, rawDiff, aiSummary, mindMap } = snapshot;
  const files = pr.files.map((file) => `${file.status} ${file.path} +${file.additions}/-${file.deletions}`).join('\n');
  const summary = aiSummary
    ? [
        aiSummary.tldr ? `TL;DR: ${aiSummary.tldr}` : undefined,
        aiSummary.whatChanged?.length ? `What changed:\n${aiSummary.whatChanged.map((item) => `- ${item}`).join('\n')}` : undefined,
        aiSummary.hotSpots?.length ? `Hot spots:\n${aiSummary.hotSpots.map((item) => `- ${item}`).join('\n')}` : undefined,
      ].filter(Boolean).join('\n')
    : '(not generated yet)';
  const groups = mindMap?.length
    ? mindMap.map((group) => `- ${group.label} (${group.changeType}): ${group.description}; files: ${group.files.join(', ')}`).join('\n')
    : '(not generated yet)';

  return [
    `PR #${pr.overview.number}: ${pr.overview.title}`,
    `URL: ${pr.overview.url}`,
    `Author: ${pr.overview.author.login}`,
    `Branches: ${pr.overview.headRefName} → ${pr.overview.baseRefName}`,
    `Stats: +${pr.overview.additions}/-${pr.overview.deletions} across ${pr.files.length} files`,
    `Description:\n${pr.overview.body || '(empty)'}`,
    `Files:\n${files || '(none)'}`,
    `Checks:\n${pr.checks.map((check) => `${check.state} ${check.name}: ${check.description}`).join('\n') || '(none)'}`,
    `Comments:\n${pr.comments.map((comment) => `${comment.author.login}${comment.path ? ` on ${comment.path}:${comment.line ?? '?'}` : ''}: ${comment.body}`).join('\n') || '(none)'}`,
    `Reviews:\n${pr.reviews.map((review) => `${review.author.login} ${review.state}: ${review.body}`).join('\n') || '(none)'}`,
    `Generated review summary:\n${summary}`,
    `Mind map groups:\n${groups}`,
    `Unified diff:\n${truncate(rawDiff, maxDiffChars)}`,
  ].join('\n\n');
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated at ${maxChars} characters]`;
}
