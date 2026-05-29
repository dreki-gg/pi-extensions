import { For, Show } from 'solid-js';
import type { PrOverview } from '~/lib/types';

interface OverviewProps {
  pr: PrOverview;
}

const stateClass = (state: string) => `pr-state pr-state-${state.toLowerCase()}`;
const formatDate = (value: string) => (value ? new Date(value).toLocaleString() : 'Unknown');

export default function Overview(props: OverviewProps) {
  const bodyParagraphs = () => props.pr.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <section id="section-overview" class="canvas-section overview-section">
      <div class="section-header">
        <h1 class="section-title">#{props.pr.number} {props.pr.title}</h1>
        <span class={stateClass(props.pr.state)}>{props.pr.state}</span>
      </div>

      <div class="pr-card overview-card">
        <div class="overview-meta">
          <span class="pr-author">👤 {props.pr.author.login}</span>
          <span class="pr-branches">{props.pr.baseRefName} ← {props.pr.headRefName}</span>
          <span class="pr-date">Created {formatDate(props.pr.createdAt)}</span>
          <span class="pr-date">Updated {formatDate(props.pr.updatedAt)}</span>
        </div>

        <div class="pr-labels">
          <For each={props.pr.labels}>
            {(label) => (
              <span class="pr-label" data-color={label.color}>{label.name}</span>
            )}
          </For>
        </div>

        <div class="pr-stats overview-stats">
          <span class="stat-add">+{props.pr.additions} additions</span>
          <span class="stat-del">−{props.pr.deletions} deletions</span>
        </div>

        <a class="github-link" href={props.pr.url} target="_blank" rel="noreferrer">
          View on GitHub
        </a>
      </div>

      <div class="pr-card pr-body-card">
        <h2 class="section-subtitle">Description</h2>
        <Show when={bodyParagraphs().length > 0} fallback={<p class="empty-copy">No description provided.</p>}>
          <For each={bodyParagraphs()}>{(paragraph) => <p class="pr-body-paragraph">{paragraph}</p>}</For>
        </Show>
      </div>
    </section>
  );
}
