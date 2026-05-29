import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pug from 'pug';
import type { PlanData } from '../types.js';

const templatePath = join(dirname(fileURLToPath(import.meta.url)), 'templates', 'plan.pug');

export function renderPlanHtml(plan: PlanData, prototype?: string): string {
  const template = readFileSync(templatePath, 'utf8');
  const prototypeHtml = prototype?.trim() ? pug.render(prototype) : undefined;

  return pug.render(template, {
    filename: templatePath,
    plan,
    prototypeHtml,
    handoffHtml: markdownToHtml(plan.handoff),
    taskCountLabel: `${plan.tasks.length} ${plan.tasks.length === 1 ? 'task' : 'tasks'}`,
    generatedAt: new Date().toISOString(),
  });
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  let inCode = false;
  let codeLang = '';
  const codeLines: string[] = [];

  for (const line of lines) {
    // Fenced code blocks
    if (line.startsWith('```')) {
      if (!inCode) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines.length = 0;
      } else {
        const langAttr = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        html.push(`<pre><code${langAttr}>${codeLines.map(escapeHtml).join('\n')}</code></pre>`);
        inCode = false;
        codeLang = '';
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      const level = headingMatch[1].length;
      html.push(`<h${level}>${inlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`);
      continue;
    }

    // List items (- or *)
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(escapeHtml(listMatch[1]))}</li>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Paragraph
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    html.push(`<p>${inlineMarkdown(escapeHtml(line))}</p>`);
  }

  // Close unclosed blocks
  if (inCode) {
    html.push(`<pre><code>${codeLines.map(escapeHtml).join('\n')}</code></pre>`);
  }
  if (inList) html.push('</ul>');
  return html.join('\n');
}

/** Converts inline markdown (bold, italic, inline code, links) in already-escaped HTML. */
function inlineMarkdown(text: string): string {
  return (
    text
      // Inline code: `code`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
