import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
// @ts-expect-error -- turndown typings are not resolved in this extension environment.
import TurndownService from 'turndown';
import type { BrowserBackendName, RenderedPage } from './backends/types.js';

const USER_AGENT = 'pi-browser-tools/1.0';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_MARKDOWN_CHARS = 50_000;

function getFetchSignal(signal?: AbortSignal): AbortSignal {
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
    : AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

function truncateHtml(html: string): string {
  return html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html;
}

function truncateMarkdown(markdown: string): string {
  return markdown.length > MAX_MARKDOWN_CHARS
    ? `${markdown.slice(0, MAX_MARKDOWN_CHARS)}\n\n[Truncated at 50,000 characters]`
    : markdown;
}

function createTurndown(): TurndownService {
  return new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
}

function withTitle(markdown: string, title: string): string {
  const trimmed = markdown.trim();
  if (!title.trim()) return truncateMarkdown(trimmed);
  if (trimmed.startsWith('# ')) return truncateMarkdown(trimmed);
  return truncateMarkdown(`# ${title.trim()}\n\n${trimmed}`.trim());
}

function readabilityFromHtml(html: string, url: string): { title: string; contentHtml: string } {
  const { document } = parseHTML(truncateHtml(html));
  const article = new Readability(document).parse();
  return {
    title: article?.title?.trim() || document.title?.trim() || url,
    contentHtml: article?.content || document.body?.innerHTML || '',
  };
}

function articleHtmlToMarkdown(contentHtml: string, title: string): string {
  const turndown = createTurndown();
  const markdown = turndown.turndown(contentHtml || '');
  return withTitle(markdown, title);
}

export function renderedPageToMarkdown(page: RenderedPage): {
  markdown: string;
  title: string;
  method: BrowserBackendName;
  url: string;
} {
  const article = page.contentHtml?.trim()
    ? { title: page.title.trim() || page.url, contentHtml: page.contentHtml }
    : readabilityFromHtml(page.html, page.url);
  const title = page.title.trim() || article.title;

  return {
    markdown: articleHtmlToMarkdown(article.contentHtml, title),
    title,
    method: page.backend,
    url: page.url,
  };
}

export async function fetchAsMarkdown(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<{ markdown: string; title: string; method: 'fetch'; url: string }> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: getFetchSignal(options.signal),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  const finalUrl = response.url || url;
  const html = truncateHtml(await response.text());
  const article = readabilityFromHtml(html, finalUrl);

  return {
    markdown: articleHtmlToMarkdown(article.contentHtml, article.title),
    title: article.title,
    method: 'fetch',
    url: finalUrl,
  };
}
