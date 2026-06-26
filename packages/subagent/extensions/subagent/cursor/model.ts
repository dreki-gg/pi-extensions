/**
 * Cursor model-prefix parsing.
 *
 * A subagent model of the form `cursor:<model>` routes the run through
 * `cursor-agent acp` (Cursor's Composer family) instead of spawning a pi
 * process. A bare `cursor:` or `cursor` defaults to `composer-2.5`.
 */

const CURSOR_PREFIX = 'cursor:';
const DEFAULT_CURSOR_MODEL = 'composer-2.5';

export interface ParsedCursorModel {
  /** True when the model selects the Cursor ACP backend. */
  isCursor: boolean;
  /** The resolved model id: bare Cursor model name when isCursor, else passthrough. */
  model: string;
}

export function parseCursorModel(model?: string): ParsedCursorModel {
  if (!model) return { isCursor: false, model: '' };

  const trimmed = model.trim();

  if (trimmed === 'cursor') {
    return { isCursor: true, model: DEFAULT_CURSOR_MODEL };
  }

  if (trimmed.toLowerCase().startsWith(CURSOR_PREFIX)) {
    const rest = trimmed.slice(CURSOR_PREFIX.length).trim();
    return { isCursor: true, model: rest || DEFAULT_CURSOR_MODEL };
  }

  return { isCursor: false, model: trimmed };
}
