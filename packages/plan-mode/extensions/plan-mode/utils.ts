/**
 * Pure utility functions for plan mode.
 *
 * Command sandboxing is delegated to @dreki-gg/pi-command-sandbox.
 */

import { isSafeCommand as baseSafeCommand } from '@dreki-gg/pi-command-sandbox';

/**
 * Check if a command is safe for plan mode.
 *
 * Delegates to the shared command sandbox with a custom allow rule
 * for `mkdir -p .plans/` (planner needs to create plan directories).
 */
export function isSafeCommand(command: string): boolean {
  return baseSafeCommand(command, {
    allowCommand: (cmd) => isMkdirPlans(cmd),
  });
}

/** Allow mkdir only for .plans/ directory paths. */
function isMkdirPlans(command: string): boolean {
  return /^\s*mkdir\s+(-p\s+)?\.plans(\/|\\|\s|$)/.test(command);
}

/**
 * Check if a file path is inside the .plans/ directory.
 *
 * Accepts both relative (.plans/foo) and absolute paths containing .plans/.
 */
export function isPlanPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return /(?:^|\/)?\.plans\//.test(normalized);
}

// ── Plan name utilities ─────────────────────────────────────────────────────

export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Generate the next sequential task id (`t-NNN`) given existing ids.
 *
 * Uses the max numeric suffix of `t-<digits>` ids + 1, zero-padded to 3.
 * Falls back to `t-<count+1>` when no ids match the pattern.
 */
export function nextTaskId(existingIds: readonly string[]): string {
  let max = 0;
  let matched = false;
  for (const id of existingIds) {
    const m = /^t-(\d+)$/.exec(id);
    if (!m) continue;
    matched = true;
    const n = Number.parseInt(m[1], 10);
    if (n > max) max = n;
  }
  const next = matched ? max + 1 : existingIds.length + 1;
  return `t-${String(next).padStart(3, '0')}`;
}
