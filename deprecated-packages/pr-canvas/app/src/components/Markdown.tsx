import { For, Show, createMemo } from 'solid-js';
import MermaidDiagram from '~/components/MermaidDiagram';
import { parseMarkdownBlocks, renderMarkdown } from '~/lib/markdown';

interface MarkdownProps {
  source: string;
  class?: string;
}

// Renders markdown to sanitized HTML (markdown-it with html:false).
// Works in both SSR and the client since markdown-it is isomorphic.
export default function Markdown(props: MarkdownProps) {
  const blocks = createMemo(() =>
    parseMarkdownBlocks(props.source).map((block) =>
      block.type === 'markdown'
        ? { ...block, html: renderMarkdown(block.source) }
        : { ...block, html: '' },
    ),
  );

  return (
    <div class={`markdown-body ${props.class ?? ''}`}>
      <For each={blocks()}>
        {(block) => (
          <Show
            when={block.type === 'mermaid'}
            fallback={<div class="markdown-chunk" innerHTML={block.html} />}
          >
            <MermaidDiagram source={block.source} class="markdown-mermaid" />
          </Show>
        )}
      </For>
    </div>
  );
}
