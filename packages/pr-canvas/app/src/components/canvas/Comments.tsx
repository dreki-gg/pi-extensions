import { For, Show } from 'solid-js';
import Markdown from '~/components/Markdown';
import type { PrComment, PrReview } from '~/lib/types';

interface CommentsProps {
  comments: PrComment[];
  reviews: PrReview[];
}

const formatDate = (value: string) => (value ? new Date(value).toLocaleString() : 'Unknown');

const reviewStateClass = (state: string) => {
  const normalized = state.toLowerCase();
  if (normalized === 'approved') return 'badge badge-compact badge-success uppercase';
  if (normalized === 'changes_requested' || normalized === 'dismissed') return 'badge badge-compact badge-danger uppercase';
  if (normalized === 'commented' || normalized === 'pending') return 'badge badge-compact badge-warning uppercase';
  return 'badge badge-compact uppercase';
};

export default function Comments(props: CommentsProps) {
  return (
    <section id="section-comments" class="mb-8 scroll-mt-[72px]">
      <div class="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 class="m-0 text-lg font-semibold leading-tight tracking-tight">Comments</h2>
      </div>

      <div class="grid gap-3">
        <h3 class="m-0 mb-2.5 text-[13px] font-semibold text-text-primary">Reviews</h3>
        <For each={props.reviews} fallback={<p class="empty-copy">No reviews yet.</p>}>
          {(review) => (
            <article class="card p-4">
              <div class="mb-2.5 flex items-center gap-2.5 text-text-secondary">
                <span class={reviewStateClass(review.state)}>{review.state}</span>
                <span class="font-semibold text-text-primary">{review.author.login}</span>
                <time class="text-text-muted">{formatDate(review.createdAt)}</time>
              </div>
              <Show when={review.body}>
                <Markdown source={review.body} class="comment-markdown" />
              </Show>
              <div class="mt-3 grid gap-2.5">
                <For each={review.comments}>
                  {(comment) => (
                    <div class="rounded-sm border border-border bg-bg-primary p-3">
                      <div class="mb-2.5 flex items-center gap-2.5 text-text-secondary">
                        <span class="font-semibold text-text-primary">{comment.author.login}</span>
                        <Show when={comment.path}>
                          <span class="text-text-muted">{comment.path}:{comment.line}</span>
                        </Show>
                      </div>
                      <Markdown source={comment.body} class="comment-markdown" />
                    </div>
                  )}
                </For>
              </div>
            </article>
          )}
        </For>
      </div>

      <div class="mt-6 grid gap-3">
        <h3 class="m-0 mb-2.5 text-[13px] font-semibold text-text-primary">PR comments</h3>
        <For each={props.comments} fallback={<p class="empty-copy">No PR comments yet.</p>}>
          {(comment) => (
            <article class="card p-4">
              <div class="mb-2.5 flex items-center gap-2.5 text-text-secondary">
                <span class="font-semibold text-text-primary">{comment.author.login}</span>
                <time class="text-text-muted">{formatDate(comment.createdAt)}</time>
              </div>
              <Markdown source={comment.body} class="comment-markdown" />
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
