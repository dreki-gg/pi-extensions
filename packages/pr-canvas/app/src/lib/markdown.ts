import MarkdownIt from 'markdown-it';

// `html: false` escapes any raw HTML in the source, which removes the main
// XSS vector for untrusted markdown. markdown-it also blocks dangerous link
// protocols (javascript:, vbscript:, data: except images) by default, so the
// rendered output is safe to inject via innerHTML.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});

// Open all links in a new tab with safe rel attributes.
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  token.attrSet('target', '_blank');
  token.attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export interface MarkdownBlock {
  type: 'markdown' | 'mermaid';
  source: string;
}

const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  if (!source) return [];

  const blocks: MarkdownBlock[] = [];
  let cursor = 0;
  let pendingMarkdown = '';

  for (const match of source.matchAll(fencePattern)) {
    const index = match.index ?? 0;
    const fullFence = match[0];
    const info = (match[1] ?? '').trim().toLowerCase();
    const language = info.split(/\s+/)[0];
    const body = match[2] ?? '';

    pendingMarkdown += source.slice(cursor, index);

    if (language === 'mermaid') {
      if (pendingMarkdown) {
        blocks.push({ type: 'markdown', source: pendingMarkdown });
        pendingMarkdown = '';
      }
      blocks.push({ type: 'mermaid', source: body });
    } else {
      pendingMarkdown += fullFence;
    }

    cursor = index + fullFence.length;
  }

  pendingMarkdown += source.slice(cursor);
  if (pendingMarkdown) blocks.push({ type: 'markdown', source: pendingMarkdown });

  return blocks;
}

export function renderMarkdown(source: string): string {
  if (!source?.trim()) return '';
  return md.render(source);
}
