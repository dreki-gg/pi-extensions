import type { PrFile } from '../../github/types';
import { escapeHtml } from '../template';

export function renderDiffPreview(files: PrFile[]): string {
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

  const diffs = files.map(renderFileDiff).join('\n');

  return `
    <section class="canvas-section" id="section-diff-preview">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">📝 Diff Preview</span>
      </button>
      <div class="section-body">${diffs}</div>
    </section>`;
}

function renderFileDiff(file: PrFile): string {
  const badgeClass = `badge-sm badge-${file.status}`;
  const badgeLabel = file.status[0].toUpperCase();
  const diffTable = renderDiffTable(file.patch);

  return `
    <div class="diff-file">
      <div class="diff-header">
        <span class="chevron collapsed">▼</span>
        <span class="${badgeClass}">${badgeLabel}</span>
        <span>${escapeHtml(file.path)}</span>
        <span style="color: var(--text-muted); margin-left: auto; font-size: 0.75rem;">
          <span class="stat-add">+${file.additions}</span>
          <span class="stat-del">−${file.deletions}</span>
        </span>
      </div>
      <div class="diff-content collapsed">${diffTable}</div>
    </div>`;
}

function renderDiffTable(patch: string): string {
  if (!patch || patch === 'Binary files differ') {
    return '<div style="padding: 0.75rem; color: var(--text-muted); font-style: italic;">Binary file</div>';
  }

  const lines = patch.split('\n');
  let rows = '';
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Hunk header
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      rows += `<tr class="diff-line-hunk"><td class="diff-line-num"></td><td class="diff-line-num"></td><td>${escapeHtml(line)}</td></tr>`;
      continue;
    }

    if (line.startsWith('+')) {
      rows += `<tr class="diff-line-add"><td class="diff-line-num"></td><td class="diff-line-num">${newLine}</td><td>${escapeHtml(line)}</td></tr>`;
      newLine++;
    } else if (line.startsWith('-')) {
      rows += `<tr class="diff-line-del"><td class="diff-line-num">${oldLine}</td><td class="diff-line-num"></td><td>${escapeHtml(line)}</td></tr>`;
      oldLine++;
    } else if (line.startsWith(' ')) {
      rows += `<tr><td class="diff-line-num">${oldLine}</td><td class="diff-line-num">${newLine}</td><td>${escapeHtml(line)}</td></tr>`;
      oldLine++;
      newLine++;
    }
  }

  return `<table class="diff-table"><tbody>${rows}</tbody></table>`;
}
