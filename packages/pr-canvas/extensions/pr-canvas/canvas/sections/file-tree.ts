import type { PrFile } from '../../github/types';
import { escapeHtml } from '../template';

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

  // Group files by directory
  const tree = buildTree(files);
  const treeHtml = renderTree(tree);

  return `
    <section class="canvas-section" id="section-file-tree">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">📁 File Tree</span>
        <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 400;">${files.length} file${files.length === 1 ? '' : 's'}</span>
      </button>
      <div class="section-body">
        <div class="file-tree">${treeHtml}</div>
      </div>
    </section>`;
}

interface TreeDir {
  [key: string]: TreeDir | PrFile;
}

function buildTree(files: PrFile[]): TreeDir {
  const tree: TreeDir = {};

  for (const file of files) {
    const parts = file.path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current[dir] || isFile(current[dir])) {
        current[dir] = {};
      }
      current = current[dir] as TreeDir;
    }
    current[parts[parts.length - 1]] = file;
  }

  return tree;
}

function isFile(node: TreeDir | PrFile): node is PrFile {
  return 'status' in node;
}

function renderTree(tree: TreeDir, depth: number = 0): string {
  const entries = Object.entries(tree).sort(([, a], [, b]) => {
    const aIsDir = !isFile(a);
    const bIsDir = !isFile(b);
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return 0;
  });

  let html = '';

  for (const [name, node] of entries) {
    if (isFile(node)) {
      html += renderFileEntry(name, node);
    } else {
      html += `<div class="tree-dir" style="padding-left: ${depth * 1}rem">${escapeHtml(name)}/</div>`;
      html += renderTree(node, depth + 1);
    }
  }

  return html;
}

function renderFileEntry(name: string, file: PrFile): string {
  const badgeClass = `badge-sm badge-${file.status}`;
  const badgeLabel = file.status[0].toUpperCase();
  const changeBar = renderChangeBar(file.additions, file.deletions);

  const stats = [];
  if (file.additions > 0) stats.push(`<span class="stat-add">+${file.additions}</span>`);
  if (file.deletions > 0) stats.push(`<span class="stat-del">−${file.deletions}</span>`);

  return `
    <div class="tree-file">
      <span class="${badgeClass}">${badgeLabel}</span>
      <span class="tree-file-name">${escapeHtml(name)}</span>
      <span class="tree-file-stats">${stats.join(' ')} ${changeBar}</span>
    </div>`;
}

function renderChangeBar(additions: number, deletions: number): string {
  const total = additions + deletions;
  if (total === 0) return '';

  const maxBlocks = 5;
  const addBlocks = Math.round((additions / total) * maxBlocks);
  const delBlocks = maxBlocks - addBlocks;

  let blocks = '';
  for (let i = 0; i < addBlocks; i++) blocks += '<span class="change-bar-block change-bar-add"></span>';
  for (let i = 0; i < delBlocks; i++) blocks += '<span class="change-bar-block change-bar-del"></span>';

  return `<span class="change-bar">${blocks}</span>`;
}
