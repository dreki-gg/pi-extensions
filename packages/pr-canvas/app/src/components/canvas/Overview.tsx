import { For, Show } from 'solid-js';
import Icon from '~/components/Icon';
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
  const bodyParagraphs = () =>
    props.pr.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <section id="section-overview" class="canvas-section">
      <div class="pr-card overview-card">
        <dl class="overview-facts">
          <div class="overview-fact">
            <dt>Author</dt>
            <dd class="overview-author">
              <Icon name="user" size={15} />
              {props.pr.author.login}
            </dd>
          </div>
          <div class="overview-fact">
            <dt>Created</dt>
            <dd>{formatDate(props.pr.createdAt)}</dd>
          </div>
          <div class="overview-fact">
            <dt>Updated</dt>
            <dd>{formatDate(props.pr.updatedAt)}</dd>
          </div>
        </dl>

        <Show when={props.pr.labels.length > 0}>
          <div class="pr-labels">
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

      <div class="pr-card pr-body-card">
        <h2 class="section-subtitle">Description</h2>
        <Show
          when={bodyParagraphs().length > 0}
          fallback={<p class="empty-copy">No description provided.</p>}
        >
          <For each={bodyParagraphs()}>
            {(paragraph) => <p class="pr-body-paragraph">{paragraph}</p>}
          </For>
        </Show>
      </div>
    </section>
  );
}
