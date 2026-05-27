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

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.trim()) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }

  if (inList) html.push('</ul>');
  return html.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
