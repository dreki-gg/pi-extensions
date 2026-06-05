import { agentBrowserBackend } from './agent-browser.js';
import { assertAgentBrowserAvailable } from './agent-browser-cli.js';
import type { BrowserBackend, BrowserBackendName } from './types.js';

let resolvedBrowserBackendPromise: Promise<BrowserBackend> | null = null;

export type ResolveBrowserBackendOptions = {
  /** Availability probe for agent-browser. Defaults to the real CLI doctor check. */
  checkAvailable?: () => Promise<void>;
};

/**
 * Resolve the active browser backend, memoized for the process lifetime.
 *
 * agent-browser is the only supported backend. Resolution hard-fails with
 * install guidance when the CLI is unavailable.
 */
export function resolveBrowserBackend(
  options: ResolveBrowserBackendOptions = {},
): Promise<BrowserBackend> {
  resolvedBrowserBackendPromise ??= selectBrowserBackend(
    options.checkAvailable ?? assertAgentBrowserAvailable,
  );
  return resolvedBrowserBackendPromise;
}

/**
 * Pure selection core (no memoization, explicit inputs) — used by
 * {@link resolveBrowserBackend} and unit tests.
 */
export async function selectBrowserBackend(
  checkAvailable: () => Promise<void>,
): Promise<BrowserBackend> {
  await checkAvailable();
  return agentBrowserBackend;
}

/** Reset memoized resolution. Intended for tests only. */
export function resetResolvedBrowserBackend(): void {
  resolvedBrowserBackendPromise = null;
}

export type { BrowserBackendName };
