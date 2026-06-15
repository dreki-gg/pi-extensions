/**
 * Pure id / name helpers shared by the engine and its consumers.
 */

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
