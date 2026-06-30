/**
 * Resolve an optional external `target` working directory for the write tools
 * (submit_plan / revise_plan / add_task).
 *
 * The use-case: while working in repo A you discover a gap in package B (which
 * you author) and want to file the plan straight into B's `.plans/` registry so
 * it becomes a first-class local plan there. The `target` points at B's repo
 * root (NOT its `.plans/` dir).
 *
 * Returns `undefined` when no target is given (caller uses the default,
 * cwd-bound runtime). When a target is given it is expanded (`~`), resolved to
 * an absolute path, and validated to be an existing directory — a missing or
 * non-directory target throws so we never silently create `.plans/` inside a
 * typo'd path.
 */

import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { stat } from 'node:fs/promises';

/** Expand a leading `~` / `~/` to the user's home directory. */
function expandHome(input: string): string {
  if (input === '~') return homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return resolve(homedir(), input.slice(2));
  }
  return input;
}

/**
 * Resolve and validate an external target directory.
 *
 * @returns the absolute target dir, or `undefined` when `target` is empty/absent.
 * @throws  when the resolved path does not exist or is not a directory.
 */
export async function resolvePlanTarget(target?: string): Promise<string | undefined> {
  const trimmed = target?.trim();
  if (!trimmed) return undefined;

  const expanded = expandHome(trimmed);
  const absolute = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);

  let stats;
  try {
    stats = await stat(absolute);
  } catch {
    throw new Error(
      `target directory does not exist: ${absolute}. Pass the repo root of the project whose .plans/ should receive this plan.`,
    );
  }
  if (!stats.isDirectory()) {
    throw new Error(`target is not a directory: ${absolute}. Pass the repo root, not a file.`);
  }
  return absolute;
}
