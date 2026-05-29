import type { PrData } from '../github/types';
import type { MindMapGroup, AiSummary } from '../ai/types';
import { wrapInHtml } from './template';
import { renderOverview } from './sections/overview';
import { renderFileTree } from './sections/file-tree';
import { renderMindMap } from './sections/mind-map';
import { renderDiffPreview } from './sections/diff-preview';
import { renderChecks } from './sections/checks';
import { renderComments } from './sections/comments';
import { renderAiSummary } from './sections/ai-summary';

export interface CanvasData {
  pr: PrData;
  mindMap: MindMapGroup[];
  aiSummary: AiSummary;
}

export function generateCanvas(data: CanvasData): string {
  const { pr, mindMap, aiSummary } = data;

  const sections = [
    renderOverview(pr.overview),
    renderFileTree(pr.files),
    renderMindMap(mindMap),
    renderDiffPreview(pr.files),
    renderChecks(pr.checks),
    renderComments(pr.comments, pr.reviews),
    renderAiSummary(aiSummary),
  ];

  const title = `PR #${pr.overview.number} — ${pr.overview.title}`;
  return wrapInHtml(title, sections);
}
