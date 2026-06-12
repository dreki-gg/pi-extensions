/**
 * Render a stack as a PR-description block and upsert it into a PR body between
 * stable markers, so re-running sync replaces (rather than duplicates) it.
 */
import type { StackNode } from '../stack/parser';
import { renderStack } from '../stack/render';
import type { Stack } from './types';

export const BLOCK_START = '<!-- pi-stack:start -->';
export const BLOCK_END = '<!-- pi-stack:end -->';

/** Convert a Stack chain into the StackNode tree the renderer expects. */
function toNodes(stack: Stack, highlight?: string): StackNode[] {
  // Build nested nodes bottom-up: trunk root -> entry chain.
  let child: StackNode | undefined;
  for (let i = stack.entries.length - 1; i >= 0; i--) {
    const entry = stack.entries[i]!;
    const node: StackNode = {
      branch: entry.branch,
      number: entry.prNumber,
      provider: entry.prNumber !== undefined ? 'github' : undefined,
      depth: 0,
      children: child ? [child] : [],
    };
    child = node;
  }
  const root: StackNode = {
    branch: stack.trunk,
    depth: 0,
    children: child ? [child] : [],
  };
  void highlight;
  return [root];
}

/** Render the fenced stack block (markers + tree) for a PR body. */
export function renderStackBlock(stack: Stack, highlight?: string): string {
  const tree = renderStack(toNodes(stack, highlight));
  return `${BLOCK_START}\n\n**Stack**\n\n\`\`\`\n${tree}\n\`\`\`\n\n${BLOCK_END}`;
}

/** Insert or replace the stack block in a PR body. */
export function upsertStackBlock(body: string, block: string): string {
  const start = body.indexOf(BLOCK_START);
  const end = body.indexOf(BLOCK_END);
  if (start !== -1 && end !== -1 && end > start) {
    const before = body.slice(0, start);
    const after = body.slice(end + BLOCK_END.length);
    return `${before}${block}${after}`;
  }
  const trimmed = body.replace(/\s+$/, '');
  return trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}
