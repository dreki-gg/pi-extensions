import type { AiSummary } from '../../ai/types';
import { escapeHtml } from '../template';

export function renderAiSummary(summary: AiSummary): string {
  const highlights = summary.highlights.length > 0
    ? `<div class="ai-block">
        <div class="ai-block-title">✨ Highlights</div>
        <ul class="ai-list">${summary.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
      </div>`
    : '';

  const concerns = summary.concerns.length > 0
    ? `<div class="ai-block">
        <div class="ai-block-title">⚠️ Concerns</div>
        <ul class="ai-list ai-concern">${summary.concerns.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
      </div>`
    : '';

  return `
    <section class="canvas-section" id="section-ai-summary">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">🤖 AI Summary</span>
      </button>
      <div class="section-body">
        <div class="ai-block">
          <div class="ai-block-title">Purpose</div>
          <div class="ai-block-text">${escapeHtml(summary.purpose)}</div>
        </div>
        <div class="ai-block">
          <div class="ai-block-title">Impact</div>
          <div class="ai-block-text">${escapeHtml(summary.impact)}</div>
        </div>
        ${highlights}
        ${concerns}
      </div>
    </section>`;
}
