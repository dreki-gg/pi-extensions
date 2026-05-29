import { For } from 'solid-js';
import type { AiSummary as AiSummaryData } from '~/lib/types';

interface AiSummaryProps {
  summary: AiSummaryData;
}

export default function AiSummary(props: AiSummaryProps) {
  return (
    <section id="section-ai-summary" class="canvas-section ai-summary-section">
      <div class="section-header">
        <h2 class="section-title">AI Summary</h2>
      </div>
      <div class="ai-summary-grid">
        <article class="pr-card ai-summary-block">
          <h3 class="section-subtitle">Purpose</h3>
          <p>{props.summary.purpose}</p>
        </article>
        <article class="pr-card ai-summary-block">
          <h3 class="section-subtitle">Impact</h3>
          <p>{props.summary.impact}</p>
        </article>
        <article class="pr-card ai-summary-block">
          <h3 class="section-subtitle">Highlights</h3>
          <ul class="ai-summary-list">
            <For each={props.summary.highlights}>{(item) => <li>{item}</li>}</For>
          </ul>
        </article>
        <article class="pr-card ai-summary-block ai-summary-concerns">
          <h3 class="section-subtitle">Concerns</h3>
          <ul class="ai-summary-list warning-list">
            <For each={props.summary.concerns}>{(item) => <li>{item}</li>}</For>
          </ul>
        </article>
      </div>
    </section>
  );
}
