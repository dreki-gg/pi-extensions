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
  const generationLabel = () => props.summary.generatedBy === 'ai' ? 'AI generated' : 'Heuristic fallback';

  return (
    <div class="pointer-events-none" classList={{ 'ai-summary-dock-open': open() }}>
      <button
        type="button"
        class="fixed bottom-[70px] right-5 z-[35] inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-light bg-bg-tertiary px-4 py-2.5 font-semibold text-text-primary shadow-[0_8px_24px_rgba(1,4,9,0.5)] transition-[border-color,background-color,transform] duration-[120ms] pointer-events-auto hover:border-accent hover:bg-[#222831] active:translate-y-px"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
        title="AI Summary"
      >
        <Icon name="summary" size={16} />
        <span>AI Summary</span>
        <Show when={hotSpotCount() > 0}>
          <span class="badge badge-compact badge-warning">{hotSpotCount()}</span>
        </Show>
      </button>

      <Show when={open()}>
        <aside class="summary-panel-enter fixed inset-y-0 right-0 left-auto z-40 grid w-[min(100vw,360px)] grid-rows-[auto_1fr] border-l border-border bg-bg-secondary shadow-[-16px_0_48px_rgba(1,4,9,0.4)] pointer-events-auto" aria-label="AI summary">
          <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
            <h2 class="m-0 inline-flex items-center gap-2 text-[15px] font-semibold">
              <Icon name="summary" size={16} />
              Review Summary
              <span class="rounded-full border border-border bg-bg-tertiary px-1.5 py-0.5 text-[11px] font-medium text-text-muted">{generationLabel()}</span>
            </h2>
            <button
              type="button"
              class="icon-button"
              onClick={() => setOpen(false)}
              aria-label="Close summary"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <div class="grid content-start gap-[18px] overflow-y-auto p-4">
            <section>
              <h3 class="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted">TL;DR</h3>
              <p class="m-0 mt-1.5 text-text-secondary">{tldr()}</p>
            </section>

            <Show when={whatChanged().length > 0}>
              <section>
                <h3 class="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted">What changed</h3>
                <ul class="m-0 pl-[18px] text-text-secondary [&_li+li]:mt-1.5">
                  <For each={whatChanged()}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>

            <Show when={(props.summary.systemFlow?.length ?? 0) > 0}>
              <section>
                <h3 class="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted">System / data flow</h3>
                <ul class="m-0 pl-[18px] text-text-secondary [&_li+li]:mt-1.5">
                  <For each={props.summary.systemFlow ?? []}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>

            <Show when={endpoints().length > 0}>
              <section>
                <h3 class="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted">Endpoints / surfaces</h3>
                <div class="mt-2 overflow-x-auto">
                  <table class="w-full border-collapse text-xs text-text-secondary">
                    <thead>
                      <tr>
                        <th class="border border-border bg-bg-tertiary px-2 py-1.5 text-left align-top font-semibold text-text-primary">Surface</th>
                        <th class="border border-border bg-bg-tertiary px-2 py-1.5 text-left align-top font-semibold text-text-primary">Auth</th>
                        <th class="border border-border bg-bg-tertiary px-2 py-1.5 text-left align-top font-semibold text-text-primary">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={endpoints()}>
                        {(surface) => (
                          <tr>
                            <td class="border border-border px-2 py-1.5 align-top"><code class="font-mono text-[11px]">{surface.method} {surface.path}</code></td>
                            <td class="border border-border px-2 py-1.5 align-top">{surface.auth}</td>
                            <td class="border border-border px-2 py-1.5 align-top">{surface.change}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </section>
            </Show>

            <Show when={dataStructures().length > 0}>
              <section>
                <h3 class="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted">Data structures</h3>
                <ul class="m-0 pl-[18px] text-text-secondary [&_li+li]:mt-1.5">
                  <For each={dataStructures()}>
                    {(structure) => (
                      <li>
                        <strong>{structure.name}</strong> <span class="font-mono text-[11px] text-text-muted">{structure.source}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>

            <Show when={hotSpots().length > 0}>
              <section>
                <h3 class="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted">Review hot-spots</h3>
                <ul class="warning-list m-0 pl-[18px] text-text-secondary [&_li+li]:mt-1.5">
                  <For each={hotSpots()}>{(item) => <li>{item}</li>}</For>
                </ul>
              </section>
            </Show>

            <Show when={openQuestions().length > 0}>
              <section>
                <h3 class="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted">Open questions</h3>
                <ul class="m-0 pl-[18px] text-text-secondary [&_li+li]:mt-1.5">
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
