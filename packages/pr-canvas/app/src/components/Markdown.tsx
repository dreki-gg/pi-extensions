import { createMemo } from 'solid-js';
import { renderMarkdown } from '~/lib/markdown';

interface MarkdownProps {
  source: string;
  class?: string;
}

// Renders markdown to sanitized HTML (markdown-it with html:false).
// Works in both SSR and the client since markdown-it is isomorphic.
export default function Markdown(props: MarkdownProps) {
  const html = createMemo(() => renderMarkdown(props.source));
  return <div class={`markdown-body ${props.class ?? ''}`} innerHTML={html()} />;
}
