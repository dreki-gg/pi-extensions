/**
 * Auto-approval policy for Cursor ACP permission requests.
 *
 * In ACP headless mode Cursor usually executes tool calls without prompting,
 * but when it does send `session/request_permission` the client must answer or
 * the turn blocks. We auto-select the most permissive "allow" option.
 */

import type { PermissionOption, RequestPermissionResponse } from '@agentclientprotocol/sdk';

/**
 * Choose which option to grant. Prefers `allow_always`, then `allow_once`,
 * then the first option. Returns undefined when no options are offered.
 */
export function selectPermissionOption(options: PermissionOption[]): string | undefined {
  const byKind = (kind: PermissionOption['kind']) => options.find((o) => o.kind === kind)?.optionId;
  return byKind('allow_always') ?? byKind('allow_once') ?? options[0]?.optionId;
}

export function buildPermissionResponse(optionId: string): RequestPermissionResponse {
  return { outcome: { outcome: 'selected', optionId } };
}

export function buildCancelledResponse(): RequestPermissionResponse {
  return { outcome: { outcome: 'cancelled' } };
}
