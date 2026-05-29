import { For, Show } from 'solid-js';
import type { PrComment, PrReview } from '~/lib/types';

interface CommentsProps {
  comments: PrComment[];
  reviews: PrReview[];
}

const formatDate = (value: string) => (value ? new Date(value).toLocaleString() : 'Unknown');

export default function Comments(props: CommentsProps) {
  return (
    <section id="section-comments" class="canvas-section comments-section">
      <div class="section-header">
        <h2 class="section-title">Comments</h2>
      </div>

      <div class="reviews-list">
        <h3 class="section-subtitle">Reviews</h3>
        <For each={props.reviews} fallback={<p class="empty-copy">No reviews yet.</p>}>
          {(review) => (
            <article class="pr-card review-item">
              <div class="comment-header">
                <span class={`review-state review-state-${review.state.toLowerCase()}`}>{review.state}</span>
                <span class="comment-author">{review.author.login}</span>
                <time class="comment-date">{formatDate(review.createdAt)}</time>
              </div>
              <Show when={review.body}>
                <p class="comment-body">{review.body}</p>
              </Show>
              <div class="inline-comments-list">
                <For each={review.comments}>
                  {(comment) => (
                    <div class="inline-comment">
                      <div class="comment-header">
                        <span class="comment-author">{comment.author.login}</span>
                        <Show when={comment.path}>
                          <span class="comment-location">{comment.path}:{comment.line}</span>
                        </Show>
                      </div>
                      <p class="comment-body">{comment.body}</p>
                    </div>
                  )}
                </For>
              </div>
            </article>
          )}
        </For>
      </div>

      <div class="pr-comments-list">
        <h3 class="section-subtitle">PR comments</h3>
        <For each={props.comments} fallback={<p class="empty-copy">No PR comments yet.</p>}>
          {(comment) => (
            <article class="pr-card comment-item">
              <div class="comment-header">
                <span class="comment-author">{comment.author.login}</span>
                <time class="comment-date">{formatDate(comment.createdAt)}</time>
              </div>
              <p class="comment-body">{comment.body}</p>
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
