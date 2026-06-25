import type { PrComment, PrReview } from '../../github/types';
import { escapeHtml } from '../template';

export function renderComments(comments: PrComment[], reviews: PrReview[]): string {
  const hasContent = comments.length > 0 || reviews.length > 0;

  if (!hasContent) {
    return `
      <section class="canvas-section" id="section-comments">
        <button class="section-toggle">
          <span class="chevron">▼</span>
          <span class="section-title">💬 Comments &amp; Reviews</span>
        </button>
        <div class="section-body">
          <p style="color: var(--text-muted);">No comments or reviews.</p>
        </div>
      </section>`;
  }

  const reviewCards = reviews.map(renderReviewCard).join('\n');
  const commentCards = comments.map(renderCommentCard).join('\n');

  return `
    <section class="canvas-section" id="section-comments">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">💬 Comments &amp; Reviews</span>
        <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 400;">${reviews.length} review${reviews.length === 1 ? '' : 's'}, ${comments.length} comment${comments.length === 1 ? '' : 's'}</span>
      </button>
      <div class="section-body">
        ${reviews.length > 0 ? `<h4 style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">Reviews</h4>${reviewCards}` : ''}
        ${comments.length > 0 ? `<h4 style="color: var(--text-secondary); font-size: 0.85rem; margin: 1rem 0 0.5rem;">Comments</h4>${commentCards}` : ''}
      </div>
    </section>`;
}

function renderReviewCard(review: PrReview): string {
  const stateBadge = renderReviewBadge(review.state);
  const inlineComments = review.comments.map(renderInlineComment).join('');

  return `
    <div class="comment-card">
      <div class="comment-header">
        ${stateBadge}
        <span class="comment-author">${escapeHtml(review.author.login)}</span>
        <span class="comment-time">${formatDate(review.createdAt)}</span>
      </div>
      ${review.body ? `<div class="comment-body"><p>${escapeHtml(review.body)}</p></div>` : ''}
      ${inlineComments}
    </div>`;
}

function renderInlineComment(comment: PrComment): string {
  const location = comment.path
    ? `<div class="comment-file">${escapeHtml(comment.path)}${comment.line ? `:${comment.line}` : ''}</div>`
    : '';

  return `
    <div style="border-top: 1px solid var(--border);">
      <div class="comment-header">
        ${location}
        <span class="comment-author">${escapeHtml(comment.author.login)}</span>
        <span class="comment-time">${formatDate(comment.createdAt)}</span>
      </div>
      <div class="comment-body"><p>${escapeHtml(comment.body)}</p></div>
    </div>`;
}

function renderCommentCard(comment: PrComment): string {
  return `
    <div class="comment-card">
      <div class="comment-header">
        <span class="comment-author">${escapeHtml(comment.author.login)}</span>
        <span class="comment-time">${formatDate(comment.createdAt)}</span>
      </div>
      <div class="comment-body"><p>${escapeHtml(comment.body)}</p></div>
    </div>`;
}

function renderReviewBadge(state: string): string {
  const label = state.toLowerCase().replace(/_/g, ' ');
  const cls = `badge badge-sm badge-${state.toLowerCase()}`;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
