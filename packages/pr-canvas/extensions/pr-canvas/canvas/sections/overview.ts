import type { PrOverview } from '../../github/types';
import { escapeHtml } from '../template';

export function renderOverview(pr: PrOverview): string {
  const stateBadge = renderStateBadge(pr.state);
  const labels = pr.labels
    .map(
      (l) =>
        `<span class="badge badge-label" style="border-color: #${l.color}40">${escapeHtml(l.name)}</span>`,
    )
    .join(' ');
  const reviewers = pr.reviewers.map((r) => escapeHtml(r.login)).join(', ') || 'None';
  const body = renderMarkdownBasic(pr.body);

  return `
    <section class="canvas-section" id="section-overview">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">Overview</span>
      </button>
      <div class="section-body">
        <div style="margin-bottom: 0.5rem;">
          <span style="color: var(--text-muted); font-size: 1.1rem;">#${pr.number}</span>
          <h2 style="font-size: 1.4rem; margin: 0.2rem 0;">${escapeHtml(pr.title)}</h2>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
          ${stateBadge}
          ${labels}
        </div>
        <div class="meta-row">
          <span class="meta-item">👤 ${escapeHtml(pr.author.login)}</span>
          <span class="meta-item">🔀 ${escapeHtml(pr.baseRefName)} ← ${escapeHtml(pr.headRefName)}</span>
          <span class="meta-item">
            <span class="stat-add">+${pr.additions}</span>
            <span class="stat-del">−${pr.deletions}</span>
          </span>
          <span class="meta-item">👁 ${escapeHtml(reviewers)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-item">Created: ${formatDate(pr.createdAt)}</span>
          <span class="meta-item">Updated: ${formatDate(pr.updatedAt)}</span>
          <span class="meta-item"><a href="${escapeHtml(pr.url)}" style="color: var(--accent);" target="_blank">View on GitHub ↗</a></span>
        </div>
        ${body ? `<div class="pr-body">${body}</div>` : ''}
      </div>
    </section>`;
}

function renderStateBadge(state: string): string {
  const s = state.toUpperCase();
  if (s === 'MERGED') return '<span class="badge badge-merged">Merged</span>';
  if (s === 'CLOSED') return '<span class="badge badge-closed">Closed</span>';
  return '<span class="badge badge-open">Open</span>';
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Very basic markdown → HTML (no external deps) */
function renderMarkdownBasic(md: string): string {
  if (!md?.trim()) return '';
  let html = escapeHtml(md);

  // Code blocks (```...```)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    return `<pre><code>${code}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}
