import type { PrData } from '../github/types';
import type { AiSummary } from './types';
import { buildRichHeuristicSummary } from './review-intelligence';

/**
 * Generate a deterministic architecture-review summary of the PR.
 *
 * This is the no-AI fallback used by the WebSocket bridge. It inspects PR
 * metadata, parsed files, checks, comments, and diff hunks to populate both
 * legacy fields (purpose/impact/highlights/concerns) and richer review fields
 * (TL;DR, changed surfaces, data structures, hot-spots, open questions).
 */
export function generateHeuristicSummary(pr: PrData): AiSummary {
  return buildRichHeuristicSummary(pr);
}
