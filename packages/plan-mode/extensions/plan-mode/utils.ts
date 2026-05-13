/**
 * Pure utility functions for plan mode.
 *
 * Command sandboxing is delegated to @dreki-gg/pi-command-sandbox.
 */

import { isSafeCommand as baseSafeCommand } from '@dreki-gg/pi-command-sandbox';

export interface TodoItem {
  step: number;
  text: string;
  completed: boolean;
}

/**
 * Check if a command is safe for plan mode.
 *
 * Delegates to the shared command sandbox with a custom allow rule
 * for `mkdir -p .plans/` (planner needs to create plan directories).
 */
export function isSafeCommand(command: string): boolean {
  return baseSafeCommand(command, {
    allowCommand: (cmd) => isMkdirPlans(cmd) || isCurlWithStderrRedirect(cmd),
  });
}

/** Allow mkdir only for .plans/ directory paths. */
function isMkdirPlans(command: string): boolean {
  return /^\s*mkdir\s+(-p\s+)?\.plans(\/|\\|\s|$)/.test(command);
}

/**
 * Allow curl commands that only redirect stderr to /dev/null.
 * shell-quote parses `2>/dev/null` as a stdout redirect, but it's
 * actually a stderr redirect which is safe for read-only mode.
 */
function isCurlWithStderrRedirect(command: string): boolean {
  return (
    /^\s*curl\b/.test(command) &&
    /2>\/dev\/null/.test(command) &&
    !/>(?!\/dev\/null)/.test(command.replace(/2>\/dev\/null/g, ''))
  );
}

// ── Plan extraction ─────────────────────────────────────────────────────────

export function cleanStepText(text: string): string {
  let cleaned = text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (cleaned.length > 60) {
    cleaned = `${cleaned.slice(0, 57)}...`;
  }
  return cleaned;
}

export function extractTodoItems(message: string): TodoItem[] {
  const items: TodoItem[] = [];
  const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
  if (!headerMatch) return items;

  const planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
  const numberedPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;

  for (const match of planSection.matchAll(numberedPattern)) {
    const text = match[2]
      .trim()
      .replace(/\*{1,2}$/, '')
      .trim();

    if (text.length <= 5) continue;
    if (text.startsWith('`') || text.startsWith('/') || text.startsWith('-')) continue;

    const cleaned = cleanStepText(text);
    if (cleaned.length <= 3) continue;

    items.push({ step: items.length + 1, text: cleaned, completed: false });
  }

  return items;
}

export function extractDoneSteps(message: string): number[] {
  const steps: number[] = [];
  for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
    const step = Number(match[1]);
    if (Number.isFinite(step)) steps.push(step);
  }
  return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
  const doneSteps = extractDoneSteps(text);
  for (const step of doneSteps) {
    const item = items.find((t) => t.step === step);
    if (item) item.completed = true;
  }
  return doneSteps.length;
}

// ── Plan name utilities ─────────────────────────────────────────────────────

export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
