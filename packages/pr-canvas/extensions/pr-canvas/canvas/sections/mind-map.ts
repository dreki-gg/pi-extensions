import type { MindMapGroup } from '../../ai/types';
import { escapeHtml } from '../template';

export function renderMindMap(groups: MindMapGroup[]): string {
  if (groups.length === 0) {
    return `
      <section class="canvas-section" id="section-mind-map">
        <button class="section-toggle">
          <span class="chevron">▼</span>
          <span class="section-title">🧠 Mind Map</span>
        </button>
        <div class="section-body">
          <p style="color: var(--text-muted);">No semantic groupings available.</p>
        </div>
      </section>`;
  }

  const cards = groups.map(renderGroupCard).join('\n');

  return `
    <section class="canvas-section" id="section-mind-map">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">🧠 Mind Map</span>
        <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 400;">${groups.length} group${groups.length === 1 ? '' : 's'}</span>
      </button>
      <div class="section-body">
        <div class="mind-groups">${cards}</div>
      </div>
    </section>`;
}

function renderGroupCard(group: MindMapGroup): string {
  const badgeClass = `badge badge-sm badge-${group.changeType}`;
  const files = group.files
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join('');

  return `
    <div class="mind-group">
      <div class="mind-group-header">
        <span class="${badgeClass}">${escapeHtml(group.changeType)}</span>
        <span class="mind-group-label">${escapeHtml(group.label)}</span>
      </div>
      <div class="mind-group-desc">${escapeHtml(group.description)}</div>
      <ul class="mind-group-files">${files}</ul>
    </div>`;
}
