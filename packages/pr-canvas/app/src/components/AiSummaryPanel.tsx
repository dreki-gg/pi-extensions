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
  const hotSpotCount = () => (props.summary.hotSpots?.length ?? props.summary.concerns.length);
  const tldr = () => props.summary.tldr || props.summary.purpose;
  const whatChanged = () => props.summary.whatChanged ?? props.summary.highlights;
  const hotSpots = () => props.summary.hotSpots ?? props.summary.concerns;
  const openQuestions = () => props.summary.openQuestions ?? [];
  const endpoints = () => props.summary.endpoints ?? [];
  const dataStructures = () => props.summary.dataStructures ?? [];

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
        <Show when={hotSpotCount() > 0}>
          <span class="sidebar-badge" data-tone="warning">{hotSpotCount()}</span>
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
              <h3 class="ai-summary-item-title">TL;DR</h3>
              <p>{tldr()}</p>
            </section>

            <Show when={whatChanged().length > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">What changed</h3>
                <ul class="ai-summary-list">
                  <For each={whatChanged()}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>

            <Show when={(props.summary.systemFlow?.length ?? 0) > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">System / data flow</h3>
                <ul class="ai-summary-list">
                  <For each={props.summary.systemFlow ?? []}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>

            <Show when={endpoints().length > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">Endpoints / surfaces</h3>
                <div class="ai-summary-table-wrap">
                  <table class="ai-summary-table">
                    <thead>
                      <tr>
                        <th>Surface</th>
                        <th>Auth</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={endpoints()}>
                        {(surface) => (
                          <tr>
                            <td><code>{surface.method} {surface.path}</code></td>
                            <td>{surface.auth}</td>
                            <td>{surface.change}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </section>
            </Show>

            <Show when={dataStructures().length > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">Data structures</h3>
                <ul class="ai-summary-list">
                  <For each={dataStructures()}>
                    {(structure) => (
                      <li>
                        <strong>{structure.name}</strong> <span class="source-ref">{structure.source}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>

            <Show when={hotSpots().length > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">Review hot-spots</h3>
                <ul class="ai-summary-list warning-list">
                  <For each={hotSpots()}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>

            <Show when={openQuestions().length > 0}>
              <section class="ai-summary-item">
                <h3 class="ai-summary-item-title">Open questions</h3>
                <ul class="ai-summary-list">
                  <For each={openQuestions()}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>
          </div>
        </aside>
      </Show>
    </div>
  );
}
