/**
 * Output helpers — human text by default, machine JSON under `--json`.
 */

import type { TaskStatus } from '../types.js';

export const STATUS_GLYPH: Record<TaskStatus, string> = {
  done: '✓',
  skipped: '⊘',
  blocked: '✗',
  pending: '○',
  deferred: '+',
};

/** Print either pretty JSON (when `json`) or the supplied human text. */
export function emit(json: boolean, payload: unknown, human: string): void {
  if (json) process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  else process.stdout.write(human + '\n');
}
