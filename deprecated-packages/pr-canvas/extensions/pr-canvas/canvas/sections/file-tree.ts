import type { PrFile } from '../../github/types';

/**
 * Render the file tree section.
 *
 * Embeds file paths and git status as JSON data for @pierre/trees to consume
 * via the module script in the template. The library handles tree rendering,
 * directory flattening, and git status badges.
 */
export function renderFileTree(files: PrFile[]): string {
  if (files.length === 0) {
    return `
      <section class="canvas-section" id="section-file-tree">
        <button class="section-toggle">
          <span class="chevron">▼</span>
          <span class="section-title">📁 File Tree</span>
        </button>
        <div class="section-body">
          <p style="color: var(--text-muted);">No files changed.</p>
        </div>
      </section>`;
  }

  // Build the data structure for @pierre/trees
  const treeData = {
    paths: files.map((f) => f.path),
    gitStatus: buildGitStatus(files),
  };

  return `
    <section class="canvas-section" id="section-file-tree">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">📁 File Tree</span>
        <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 400;">${files.length} file${files.length === 1 ? '' : 's'}</span>
      </button>
      <div class="section-body">
        <div id="pierre-tree-container" style="height: ${Math.min(files.length * 28 + 40, 500)}px;"></div>
      </div>
      <script type="application/json" id="pierre-tree-data">${JSON.stringify(treeData)}</script>
    </section>`;
}

/**
 * Map PrFile statuses to @pierre/trees gitStatus format.
 * Keys are file paths, values are git status strings.
 */
function buildGitStatus(files: PrFile[]): Record<string, string> {
  const status: Record<string, string> = {};
  for (const file of files) {
    switch (file.status) {
      case 'added':
        status[file.path] = 'added';
        break;
      case 'modified':
        status[file.path] = 'modified';
        break;
      case 'deleted':
        status[file.path] = 'deleted';
        break;
      case 'renamed':
        status[file.path] = 'renamed';
        break;
    }
  }
  return status;
}
