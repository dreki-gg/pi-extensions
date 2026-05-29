import { For, Show } from 'solid-js';
import MermaidDiagram from '~/components/MermaidDiagram';
import type { MindMapGroup } from '~/lib/types';

interface MindMapProps {
  groups: MindMapGroup[];
}

export default function MindMap(props: MindMapProps) {
  return (
    <section id="section-mind-map" class="canvas-section mind-map-section">
      <div class="section-header">
        <h2 class="section-title">Mind Map</h2>
      </div>
      <div class="mind-map-grid">
        <For each={props.groups}>
          {(group) => (
            <article class="pr-card mind-map-card">
              <div class="mind-map-card-header">
                <span class={`change-type-badge change-type-${group.changeType}`}>{group.changeType}</span>
                <h3 class="mind-map-title">{group.label}</h3>
              </div>
              <p class="mind-map-description">{group.description}</p>
              <Show when={group.diagram}>
                {(diagram) => <MermaidDiagram source={diagram()} />}
              </Show>
              <Show when={group.relationships?.length}>
                <ul class="mind-map-relationships">
                  <For each={group.relationships}>{(item) => <li>{item}</li>}</For>
                </ul>
              </Show>
              <ul class="mind-map-files">
                <For each={group.files}>{(file) => <li class="mind-map-file">{file}</li>}</For>
              </ul>
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
