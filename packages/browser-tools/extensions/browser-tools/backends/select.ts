import { agentBrowserBackend } from './agent-browser.js';
import { assertAgentBrowserAvailable } from './agent-browser-cli.js';
import { playwrightBackend } from './playwright.js';
import type { BrowserBackend, BrowserBackendName } from './types.js';

const env =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

export type BrowserBackendSelection = 'playwright' | 'agent-browser' | 'auto';

/**
 * The backend the user explicitly requested via `PI_BROWSER_BACKEND`.
 * `auto` means "prefer agent-browser, fall back to playwright".
 */
const requestedBrowserBackend = normalizeBrowserBackendSelection(env.PI_BROWSER_BACKEND);

let resolvedBrowserBackendPromise: Promise<BrowserBackend> | null = null;

/** The selection requested via env (may be `auto`). */
export function getRequestedBrowserBackend(): BrowserBackendSelection {
  return requestedBrowserBackend;
}

export type ResolveBrowserBackendOptions = {
  /** Availability probe for agent-browser. Defaults to the real CLI doctor check. */
  checkAvailable?: () => Promise<void>;
};

/**
 * Resolve the active browser backend, memoized for the process lifetime.
 *
 * - `PI_BROWSER_BACKEND=playwright` → playwright.
 * - `PI_BROWSER_BACKEND=agent-browser` → agent-browser, hard-failing with install
 *   guidance when the CLI is unavailable.
 * - unset / invalid (`auto`) → agent-browser when available, otherwise silently
 *   falls back to playwright.
 */
export function resolveBrowserBackend(
  options: ResolveBrowserBackendOptions = {},
): Promise<BrowserBackend> {
  resolvedBrowserBackendPromise ??= resolveBrowserBackendUncached(options);
  return resolvedBrowserBackendPromise;
}

function resolveBrowserBackendUncached(
  options: ResolveBrowserBackendOptions,
): Promise<BrowserBackend> {
  return selectBrowserBackend(
    requestedBrowserBackend,
    options.checkAvailable ?? assertAgentBrowserAvailable,
  );
}

/**
 * Pure selection core (no memoization, explicit inputs) — used by
 * {@link resolveBrowserBackend} and unit tests.
 */
export async function selectBrowserBackend(
  selection: BrowserBackendSelection,
  checkAvailable: () => Promise<void>,
): Promise<BrowserBackend> {
  if (selection === 'playwright') {
    return playwrightBackend;
  }

  if (selection === 'agent-browser') {
    await checkAvailable();
    return agentBrowserBackend;
  }

  // auto: prefer agent-browser, fall back to playwright when unavailable.
  try {
    await checkAvailable();
    return agentBrowserBackend;
  } catch {
    return playwrightBackend;
  }
}

/** Reset memoized resolution. Intended for tests only. */
export function resetResolvedBrowserBackend(): void {
  resolvedBrowserBackendPromise = null;
}

function normalizeBrowserBackendSelection(value?: string): BrowserBackendSelection {
  switch (value?.trim().toLowerCase()) {
    case 'agent-browser':
      return 'agent-browser';
    case 'playwright':
      return 'playwright';
    default:
      return 'auto';
  }
}

export type { BrowserBackendName };
