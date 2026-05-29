import { For, Show, createSignal } from 'solid-js';
import Icon from '~/components/Icon';
import type { AiSummary } from '~/lib/types';

interface AiSummaryPanelProps {
  summary: AiSummary;
}

/**
 * Floating, collapsible AI Summary sidebar pinned to the right edge of the
 * layout. Opens over the content rather than reserving column width.
 */
export default function AiSummaryPanel(props: AiSummaryPanelProps) {
  const [open, setOpen] = createSignal(false);
  const concernCount = () => props.summary.concerns.length;

  return (
    <div class="ai-summary-dock" classList={{ 'ai-summary-dock-open': open() }}>
      <button
        type="button"
        class="ai-summary-tab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
        title="AI Summary"
      >
        <Icon name="summary" size={16} />
        <span>AI Summary</span>
        <Show when={concernCount() > 0}>
          <span class="sidebar-badge" data-tone="warning">{concernCount()}</span>
        </Show>
      </button>

      <Show when={open()}>
        <aside class="ai-summary-panel" aria-label="AI summary">
          <div class="ai-summary-panel-header">
            <h2 class="ai-summary-panel-title">
              <Icon name="summary" size={16} />
              AI Summary
            </h2>
            <button
              type="button"
              class="ai-chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close summary"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <div class="ai-summary-panel-body">
            <section class="ai-summary-item">
              <h3 class="ai-summary-item-title">Purpose</h3>
              <p>{props.summary.purpose}</p>
            </section>
            <section class="ai-summary-item">
              <h3 class="ai-summary-item-title">Impact</h3>
              <p>{props.summary.impact}</p>
            </section>
            <Show when={props.summary.highlights.length > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">Highlights</h3>
                <ul class="ai-summary-list">
                  <For each={props.summary.highlights}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>
            <Show when={props.summary.concerns.length > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">Concerns</h3>
                <ul class="ai-summary-list warning-list">
                  <For each={props.summary.concerns}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>
          </div>
        </aside>
      </Show>
    </div>
  );
}
