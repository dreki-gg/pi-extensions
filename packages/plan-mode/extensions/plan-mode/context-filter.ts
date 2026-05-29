/**
 * Message filtering for the context event — strips planning artifacts during execution
 * and removes stale plan-mode injections when not in plan mode.
 */

/** Drop everything before the execution start index. */
export function filterExecutionMessages<T>(messages: T[], executionStartIdx: number): T[] {
  return messages.filter((_m, i) => i >= executionStartIdx);
}

/** Strip stale plan-mode injected messages when not in plan mode. */
export function filterStalePlanMessages<T>(messages: T[]): T[] {
  return messages.filter((m) => {
    const msg = m as { customType?: string; role?: string; content?: unknown };
    if (msg.customType === 'plan-mode-context') return false;
    if (msg.role !== 'user') return true;
    const content = msg.content;
    if (typeof content === 'string') {
      return !content.includes('[PLAN MODE ACTIVE]');
    }
    if (Array.isArray(content)) {
      return !content.some(
        (c: { type?: string; text?: string }) =>
          c.type === 'text' && c.text?.includes('[PLAN MODE ACTIVE]'),
      );
    }
    return true;
  });
}
