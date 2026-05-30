import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pug from 'pug';

const templatePath = join(dirname(fileURLToPath(import.meta.url)), 'templates', 'prototype.pug');

/**
 * Renders a standalone prototype preview: a minimal header (title + one-line
 * intent) wrapping the rendered Pug body. This is a planning-phase visual aid,
 * not a plan dump — no tasks, no handoff.
 */
export function renderPrototypeHtml(title: string, intent: string, pugBody: string): string {
  const template = readFileSync(templatePath, 'utf8');
  const prototypeHtml = pugBody.trim() ? pug.render(pugBody) : '';

  return pug.render(template, {
    filename: templatePath,
    title,
    intent,
    prototypeHtml,
    generatedAt: new Date().toISOString(),
  });
}
