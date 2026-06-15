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

// Plan name / task id helpers (`toKebabCase`, `nextTaskId`) now live in
// `@dreki-gg/taskman`.
