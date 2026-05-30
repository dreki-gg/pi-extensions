import { For, Show } from 'solid-js';
import Icon from '~/components/Icon';
import Markdown from '~/components/Markdown';
import type { PrOverview } from '~/lib/types';

interface OverviewProps {
  pr: PrOverview;
}

const formatDate = (value: string) => (value ? new Date(value).toLocaleString() : 'Unknown');

// GitHub label colors are hex without '#'. Derive a readable tint + text color.
function labelStyle(color: string) {
  const hex = color?.replace('#', '') || '8b949e';
  return {
    '--label-color': `#${hex}`,
  } as Record<string, string>;
}

export default function Overview(props: OverviewProps) {
  const hasBody = () => props.pr.body.trim().length > 0;

  return (
    <section id="section-overview" class="mb-8 scroll-mt-[72px]">
      <div class="card mb-3.5 p-[18px]">
        <dl class="m-0 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt class="mb-1 text-xs text-text-muted">Author</dt>
            <dd class="m-0 inline-flex items-center gap-1.5 text-text-primary">
              <Icon name="user" size={15} />
              {props.pr.author.login}
            </dd>
          </div>
          <div>
            <dt class="mb-1 text-xs text-text-muted">Created</dt>
            <dd class="m-0 text-text-primary">{formatDate(props.pr.createdAt)}</dd>
          </div>
          <div>
            <dt class="mb-1 text-xs text-text-muted">Updated</dt>
            <dd class="m-0 text-text-primary">{formatDate(props.pr.updatedAt)}</dd>
          </div>
        </dl>

        <Show when={props.pr.labels.length > 0}>
          <div class="mt-4 flex flex-wrap gap-2">
            <For each={props.pr.labels}>
              {(label) => (
                <span class="pr-label" style={labelStyle(label.color)}>
                  {label.name}
                </span>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="card p-[18px]">
        <h2 class="m-0 mb-2.5 text-[13px] font-semibold text-text-primary">Description</h2>
        <Show when={hasBody()} fallback={<p class="empty-copy">No description provided.</p>}>
          <Markdown source={props.pr.body} />
        </Show>
      </div>
    </section>
  );
}
