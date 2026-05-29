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

export function renderMarkdown(source: string): string {
  if (!source?.trim()) return '';
  return md.render(source);
}
