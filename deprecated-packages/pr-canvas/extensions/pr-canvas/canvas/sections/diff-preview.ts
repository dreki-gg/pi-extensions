import type { PrFile } from '../../github/types';

/**
 * Render the diff preview section.
 *
 * Embeds the raw unified diff as JSON data for @pierre/diffs to consume
 * via the module script in the template. The library handles syntax highlighting,
 * split/unified views, and all diff rendering.
 */
export function renderDiffPreview(files: PrFile[], rawDiff: string): string {
  if (files.length === 0) {
    return `
      <section class="canvas-section" id="section-diff-preview">
        <button class="section-toggle">
          <span class="chevron">▼</span>
          <span class="section-title">📝 Diff Preview</span>
        </button>
        <div class="section-body">
          <p style="color: var(--text-muted);">No diffs to show.</p>
        </div>
      </section>`;
  }

  // Escape the raw diff for safe embedding in a JSON script tag
  const escapedDiff = JSON.stringify(rawDiff);

  return `
    <section class="canvas-section" id="section-diff-preview">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">📝 Diff Preview</span>
        <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 400;">${files.length} file${files.length === 1 ? '' : 's'}</span>
      </button>
      <div class="section-body">
        <div class="pierre-diff-controls">
          <button id="diff-layout-toggle" class="pierre-control-btn">Split View</button>
        </div>
        <div id="pierre-diffs-container"></div>
      </div>
      <script type="application/json" id="pierre-diff-data">${escapedDiff}</script>
    </section>`;
}
