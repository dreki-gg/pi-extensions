import { For, Show } from 'solid-js';
import MermaidDiagram from '~/components/MermaidDiagram';
import type { MindMapGroup } from '~/lib/types';

interface MindMapProps {
  groups: MindMapGroup[];
}

const changeTypeBadgeClass = (type: MindMapGroup['changeType']) => {
  switch (type) {
    case 'feature':
      return 'badge badge-success lowercase';
    case 'fix':
      return 'badge badge-danger lowercase';
    case 'refactor':
      return 'badge badge-accent lowercase';
    default:
      return 'badge badge-purple lowercase';
  }
};

export default function MindMap(props: MindMapProps) {
  return (
    <section id="section-mind-map" class="mb-8 scroll-mt-[72px]">
      <div class="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 class="m-0 text-lg font-semibold leading-tight tracking-tight">Mind Map</h2>
      </div>
      <div class="grid grid-cols-1 gap-3.5">
        <For each={props.groups}>
          {(group) => (
            <article class="card grid gap-2.5 p-4">
              <div class="flex items-center gap-2.5">
                <span class={changeTypeBadgeClass(group.changeType)}>{group.changeType}</span>
                <h3 class="m-0 flex-1 text-[15px] font-semibold">{group.label}</h3>
              </div>
              <p class="m-0 text-text-secondary">{group.description}</p>
              <Show when={group.diagram}>
                {(diagram) => <MermaidDiagram source={diagram()} />}
              </Show>
              <Show when={group.relationships?.length}>
                <ul class="m-0 pl-[18px] text-text-secondary [&_li+li]:mt-1">
                  <For each={group.relationships}>{(item) => <li>{item}</li>}</For>
                </ul>
              </Show>
              <ul class="m-0 pl-[18px] text-text-secondary">
                <For each={group.files}>{(file) => <li class="mt-1 break-all font-mono text-xs text-text-primary">{file}</li>}</For>
              </ul>
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
