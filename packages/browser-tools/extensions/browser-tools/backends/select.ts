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

const selectedBrowserBackendName = normalizeBrowserBackendName(env.PI_BROWSER_BACKEND);
const selectedBrowserBackend =
  selectedBrowserBackendName === 'agent-browser' ? agentBrowserBackend : playwrightBackend;
let selectedBrowserBackendAvailability: Promise<void> | null = null;

export function getSelectedBrowserBackendName(): BrowserBackendName {
  return selectedBrowserBackendName;
}

export function getSelectedBrowserBackend(): BrowserBackend {
  return selectedBrowserBackend;
}

export async function ensureSelectedBrowserBackendAvailable(): Promise<void> {
  if (selectedBrowserBackendName !== 'agent-browser') {
    return;
  }

  selectedBrowserBackendAvailability ??= assertAgentBrowserAvailable();
  await selectedBrowserBackendAvailability;
}

function normalizeBrowserBackendName(value?: string): BrowserBackendName {
  switch (value?.trim().toLowerCase()) {
    case 'agent-browser':
      return 'agent-browser';
    case 'playwright':
    default:
      return 'playwright';
  }
}
