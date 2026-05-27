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

// ── Plan name utilities ─────────────────────────────────────────────────────

export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
