import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertAgentBrowserAvailable,
  runAgentBrowserJson,
  viewportFor,
} from './agent-browser-cli.js';
import { resolveTargetRef } from './resolve-target.js';
import { buildCdpConnectError } from './cdp-connect-error.js';
import { encodeScreenshot } from '../image/screenshot.js';
import type {
  BrowserBackend,
  BrowserInteractParams,
  BrowserScreenshotResult,
  BrowserStatus,
  ConsoleEntry,
  RenderedPage,
  ViewportPreset,
} from './types.js';

const DEFAULT_WAIT_MS = 1_500;
const POST_INTERACTION_WAIT_MS = 500;
const MAX_CONSOLE_ENTRIES = 1_000;

type AgentBrowserSnapshotRef = {
  name?: string;
  role?: string;
};

type AgentBrowserSnapshotData = {
  origin?: string;
  refs?: Record<string, AgentBrowserSnapshotRef>;
  snapshot?: string;
};

type AgentBrowserConsoleMessage = {
  text?: string;
  type?: string;
  url?: string | null;
  timestamp?: number;
  args?: Array<{ value?: unknown; description?: string; type?: string }>;
};

type AgentBrowserConsoleData = {
  messages?: AgentBrowserConsoleMessage[];
};

type AgentBrowserErrorEntry = {
  text?: string;
  url?: string | null;
  timestamp?: number;
};

type AgentBrowserErrorsData = {
  errors?: AgentBrowserErrorEntry[];
};

type AgentBrowserSetViewportData = {
  width?: number;
  height?: number;
};

type AgentBrowserUrlData = {
  url?: string;
};

type AgentBrowserTextData = {
  text?: string;
};

type AgentBrowserEvalResult = {
  html?: string;
  title?: string;
  url?: string;
};

class AgentBrowserBackend implements BrowserBackend {
  readonly name = 'agent-browser' as const;

  private queue: Promise<unknown> = Promise.resolve();
  private availableChecked = false;
  private suppressedPageErrorCounts = new Map<string, number>();
  private cdpTarget: string | null = null;
  private connected = false;
  private status: BrowserStatus = {
    isOpen: false,
    url: null,
    viewport: null,
  };

  isOpen(): boolean {
    return this.status.isOpen;
  }

  bindCdpTarget(target: string | null): void {
    // First non-null target wins for the session; later calls (and null) are ignored.
    if (this.cdpTarget || !target) {
      return;
    }
    this.cdpTarget = target;
  }

  getStatus(): BrowserStatus {
    return {
      isOpen: this.status.isOpen,
      url: this.status.url,
      viewport: this.status.viewport,
    };
  }

  async navigate(
    url: string,
    options?: { preset?: ViewportPreset; width?: number; height?: number; waitMs?: number },
  ): Promise<{ url: string; viewport: { width: number; height: number } | null }> {
    return this.runExclusive(async () => {
      await this.ensureAvailable();
      await this.openInternal(url);

      if (options?.preset || options?.width !== undefined || options?.height !== undefined) {
        await this.setViewportInternal(options.preset ?? 'desktop', options.width, options.height);
      } else if (!this.status.viewport) {
        await this.setViewportInternal('desktop');
      }

      await this.waitForPage(options?.waitMs ?? DEFAULT_WAIT_MS);
      await this.refreshUrl(url);
      return {
        url: this.status.url ?? url,
        viewport: this.status.viewport,
      };
    });
  }

  async setViewport(
    preset: ViewportPreset = 'desktop',
    width?: number,
    height?: number,
  ): Promise<{ width: number; height: number }> {
    return this.runExclusive(async () => {
      await this.ensureAvailable();
      return this.setViewportInternal(preset, width, height);
    });
  }

  async screenshot(options?: {
    url?: string;
    preset?: ViewportPreset;
    width?: number;
    height?: number;
    waitMs?: number;
  }): Promise<BrowserScreenshotResult> {
    return this.runExclusive(async () => {
      await this.ensureAvailable();

      if (options?.url) {
        await this.openInternal(options.url);
      } else {
        await this.ensureReady();
      }

      if (options?.preset || options?.width !== undefined || options?.height !== undefined) {
        await this.setViewportInternal(options.preset ?? 'desktop', options.width, options.height);
      } else if (!this.status.viewport) {
        await this.setViewportInternal('desktop');
      }

      if (options?.url || options?.waitMs !== undefined) {
        await this.waitForPage(options?.waitMs ?? DEFAULT_WAIT_MS);
      }

      const captured = await this.captureScreenshot();
      await this.refreshUrl(options?.url);

      return {
        imageBase64: captured.base64,
        mimeType: captured.mimeType,
        url: this.status.url,
        viewport: this.status.viewport,
      };
    });
  }

  async interact(params: BrowserInteractParams): Promise<{
    url: string | null;
    viewport: { width: number; height: number } | null;
  }> {
    if (!this.isOpen()) {
      throw new Error(
        'Browser is not open. Use web_screenshot or web_visit with render:true first.',
      );
    }

    return this.runExclusive(async () => {
      await this.ensureAvailable();
      await this.ensureReady();

      switch (params.action) {
        case 'scroll': {
          await runAgentBrowserJson([
            'scroll',
            params.direction ?? 'down',
            String(Math.abs(params.amount ?? 500)),
          ]);
          break;
        }
        case 'wait': {
          await this.waitForPage(params.timeout ?? 1_000);
          break;
        }
        case 'click': {
          const target = await this.resolveTarget(params);
          await runAgentBrowserJson(['click', target]);
          break;
        }
        case 'hover': {
          const target = await this.resolveTarget(params);
          await runAgentBrowserJson(['hover', target]);
          break;
        }
        case 'type': {
          if (params.value === undefined) throw new Error('type action requires value');
          const target = await this.resolveTarget(params);
          await runAgentBrowserJson(['fill', target, params.value]);
          break;
        }
        case 'select': {
          if (params.value === undefined) throw new Error('select action requires value');
          const target = await this.resolveTarget(params);
          await runAgentBrowserJson(['select', target, params.value]);
          break;
        }
        default:
          throw new Error(`Unsupported action: ${String(params.action)}`);
      }

      if (params.action !== 'wait') {
        await this.waitForPage(POST_INTERACTION_WAIT_MS);
      }

      await this.refreshUrl();
      return {
        url: this.status.url,
        viewport: this.status.viewport,
      };
    });
  }

  async getConsoleEntries(options?: {
    level?: ConsoleEntry['level'][];
    clear?: boolean;
  }): Promise<ConsoleEntry[]> {
    return this.runExclusive(async () => {
      if (!this.isOpen()) {
        return [];
      }

      await this.ensureAvailable();

      if (options?.clear) {
        const consoleData = await runAgentBrowserJson<AgentBrowserConsoleData>(['console']);
        const errorsData = await runAgentBrowserJson<AgentBrowserErrorsData>(['errors']);
        const visibleEntries = this.buildVisibleConsoleEntries(consoleData, errorsData);

        await runAgentBrowserJson(['console', '--clear']);
        const clearedErrorsData = await runAgentBrowserJson<AgentBrowserErrorsData>([
          'errors',
          '--clear',
        ]);
        // agent-browser can retain load-time page errors after `errors --clear`, so
        // keep a local suppression baseline for the rest of the page session.
        this.replaceSuppressedPageErrors(clearedErrorsData);

        return filterConsoleLevels(visibleEntries, options.level);
      }

      const consoleData = await runAgentBrowserJson<AgentBrowserConsoleData>(['console']);
      const errorsData = await runAgentBrowserJson<AgentBrowserErrorsData>(['errors']);
      return filterConsoleLevels(
        this.buildVisibleConsoleEntries(consoleData, errorsData),
        options?.level,
      );
    });
  }

  async renderPage(url: string): Promise<RenderedPage> {
    return this.runExclusive(async () => {
      await this.ensureAvailable();
      await this.openInternal(url);

      if (!this.status.viewport) {
        await this.setViewportInternal('desktop');
      }

      await this.waitForPage(DEFAULT_WAIT_MS);

      const result = await runAgentBrowserJson<{
        origin?: string;
        result?: AgentBrowserEvalResult;
      }>([
        'eval',
        '(() => ({ html: document.documentElement?.outerHTML ?? "", title: document.title ?? "", url: window.location.href }))()',
      ]);

      const page = result.result ?? {};
      const finalUrl = page.url?.trim() || result.origin?.trim() || this.status.url || url;
      this.markOpen(finalUrl);

      return {
        html: page.html ?? '',
        title: page.title?.trim() || finalUrl,
        url: finalUrl,
        backend: this.name,
      };
    });
  }

  async close(): Promise<void> {
    return this.runExclusive(async () => {
      await this.closeInternal();
    });
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async ensureAvailable(): Promise<void> {
    if (this.availableChecked) {
      return;
    }

    await assertAgentBrowserAvailable();
    this.availableChecked = true;
  }

  private async ensureSessionStarted(): Promise<void> {
    if (this.status.isOpen) {
      return;
    }

    await this.openInternal();
  }

  private async ensureReady(): Promise<void> {
    await this.ensureSessionStarted();
    if (!this.status.viewport) {
      await this.setViewportInternal('desktop');
    }
  }

  private async openInternal(url?: string): Promise<void> {
    if (this.cdpTarget && !this.connected) {
      // Attach to the running browser via CDP instead of launching our own.
      try {
        await runAgentBrowserJson(['connect', this.cdpTarget]);
      } catch (error) {
        throw new Error(buildCdpConnectError(this.cdpTarget, error));
      }
      this.connected = true;
      if (url) {
        await runAgentBrowserJson(['open', url]);
      }
    } else if (url) {
      await runAgentBrowserJson(['open', url]);
    } else if (!this.connected) {
      // Never issue a bare `open` on a connected session; it could spawn a
      // second browser. Reuse the already-attached active page instead.
      await runAgentBrowserJson(['open']);
    }

    this.markOpen(url ?? this.status.url ?? 'about:blank');
  }

  private async setViewportInternal(
    preset: ViewportPreset = 'desktop',
    width?: number,
    height?: number,
  ): Promise<{ width: number; height: number }> {
    await this.ensureSessionStarted();

    const targetViewport = viewportFor(preset, width, height);
    const result = await runAgentBrowserJson<AgentBrowserSetViewportData>([
      'set',
      'viewport',
      String(targetViewport.width),
      String(targetViewport.height),
    ]);

    const viewport = {
      width: result.width ?? targetViewport.width,
      height: result.height ?? targetViewport.height,
    };

    this.status.viewport = viewport;
    return viewport;
  }

  private async waitForPage(waitMs: number): Promise<void> {
    if (waitMs <= 0) {
      return;
    }

    await runAgentBrowserJson(['wait', String(waitMs)]);
  }

  private async refreshUrl(fallbackUrl?: string): Promise<void> {
    if (!this.status.isOpen) {
      return;
    }

    try {
      const result = await runAgentBrowserJson<AgentBrowserUrlData>(['get', 'url']);
      const url = result.url?.trim() || fallbackUrl || this.status.url;
      this.markOpen(url ?? null);
    } catch {
      const url = fallbackUrl ?? this.status.url ?? null;
      this.markOpen(url);
    }
  }

  private async captureScreenshot(): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' }> {
    const tempDir = await mkdtemp(join(tmpdir(), 'pi-browser-tools-agent-browser-'));
    const screenshotPath = join(tempDir, 'screenshot.png');

    try {
      await runAgentBrowserJson(['screenshot', screenshotPath]);
      const png = await readFile(screenshotPath);
      // Cap dimensions (retina/full-page captures can exceed Anthropic's 2000px
      // many-image limit) and re-encode to JPEG so a long session of
      // screenshots stays under the total request-size limit.
      return encodeScreenshot(new Uint8Array(png.buffer, png.byteOffset, png.byteLength));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async resolveTarget(params: { selector?: string; text?: string }): Promise<string> {
    if (params.selector) {
      return params.selector;
    }

    if (!params.text) {
      throw new Error('This action requires either selector or text');
    }

    const snapshot = await runAgentBrowserJson<AgentBrowserSnapshotData>(['snapshot', '-i']);
    if (snapshot.origin?.trim()) {
      this.markOpen(snapshot.origin.trim());
    }

    const refs = Object.entries(snapshot.refs ?? {});
    if (refs.length === 0) {
      throw new Error(`Could not find any interactive elements for text: ${params.text}`);
    }

    return resolveTargetRef(params.text, refs, {
      getVisibleText: (refId) => this.getVisibleTextForRef(refId),
    });
  }

  private async getVisibleTextForRef(refId: string): Promise<string | null> {
    try {
      const result = await runAgentBrowserJson<AgentBrowserTextData>(['get', 'text', `@${refId}`]);
      return result.text?.trim() || null;
    } catch {
      return null;
    }
  }

  private markOpen(url: string | null): void {
    this.status.isOpen = true;
    this.status.url = url;
  }

  private async closeInternal(): Promise<void> {
    const shouldAttemptClose = this.status.isOpen;
    // agent-browser has no `disconnect`, and `close` would close the user's
    // own browser. When attached via CDP we only drop local session state.
    const wasConnected = this.connected;
    this.status = {
      isOpen: false,
      url: null,
      viewport: null,
    };
    this.connected = false;
    this.cdpTarget = null;
    this.resetPageErrorSuppression();

    if (!shouldAttemptClose || wasConnected) {
      return;
    }

    try {
      await runAgentBrowserJson(['close']);
    } catch {
      // Ignore cleanup failures.
    }
  }

  private buildVisibleConsoleEntries(
    consoleData: AgentBrowserConsoleData,
    errorsData: AgentBrowserErrorsData,
  ): ConsoleEntry[] {
    const messages = normalizeConsoleMessages(consoleData, this.status.url);
    const errors = filterSuppressedPageErrors(
      normalizePageErrors(errorsData, this.status.url),
      this.suppressedPageErrorCounts,
    );

    return [...messages, ...errors]
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-MAX_CONSOLE_ENTRIES);
  }

  private replaceSuppressedPageErrors(errorsData: AgentBrowserErrorsData): void {
    this.suppressedPageErrorCounts = countPageErrorSignatures(
      normalizePageErrors(errorsData, this.status.url),
    );
  }

  private resetPageErrorSuppression(): void {
    this.suppressedPageErrorCounts.clear();
  }

}

function normalizeConsoleMessages(
  consoleData: AgentBrowserConsoleData,
  currentUrl: string | null,
): ConsoleEntry[] {
  const now = Date.now();
  return (consoleData.messages ?? []).map((message, index) => ({
    level: normalizeConsoleLevel(message.type),
    text: message.text?.trim() || formatConsoleArgs(message.args) || '(empty console message)',
    url: message.url ?? currentUrl,
    timestamp: message.timestamp ?? now + index,
  })) satisfies ConsoleEntry[];
}

function normalizePageErrors(
  errorsData: AgentBrowserErrorsData,
  currentUrl: string | null,
): ConsoleEntry[] {
  const now = Date.now();
  return (errorsData.errors ?? []).map((error, index) => ({
    level: 'page-error',
    text: error.text?.trim() || '(empty page error)',
    url: error.url ?? currentUrl,
    timestamp: error.timestamp ?? now + index,
  })) satisfies ConsoleEntry[];
}

function filterSuppressedPageErrors(
  entries: ConsoleEntry[],
  suppressedCounts: ReadonlyMap<string, number>,
): ConsoleEntry[] {
  if (suppressedCounts.size === 0) {
    return entries;
  }

  const remaining = new Map(suppressedCounts);
  return entries.filter((entry) => {
    const signature = pageErrorSignature(entry);
    const suppressed = remaining.get(signature) ?? 0;

    if (suppressed <= 0) {
      return true;
    }

    if (suppressed === 1) {
      remaining.delete(signature);
    } else {
      remaining.set(signature, suppressed - 1);
    }

    return false;
  });
}

function countPageErrorSignatures(entries: ConsoleEntry[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const signature = pageErrorSignature(entry);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  return counts;
}

function pageErrorSignature(entry: ConsoleEntry): string {
  // agent-browser error entries often omit a structured URL, but the stack text
  // includes the source location. Keying by text avoids resurfacing the same
  // cleared load-time error after same-session navigation back to the page.
  return entry.text;
}

function filterConsoleLevels(
  entries: ConsoleEntry[],
  allowedLevels?: ConsoleEntry['level'][],
): ConsoleEntry[] {
  if (!allowedLevels?.length) {
    return entries;
  }

  const allowed = new Set(allowedLevels);
  return entries.filter((entry) => allowed.has(entry.level));
}

function normalizeConsoleLevel(type?: string): ConsoleEntry['level'] {
  switch (type) {
    case 'info':
      return 'info';
    case 'warning':
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    case 'debug':
      return 'debug';
    case 'trace':
      return 'trace';
    case 'log':
    default:
      return 'log';
  }
}

function formatConsoleArgs(
  args?: Array<{ value?: unknown; description?: string; type?: string }>,
): string {
  if (!args?.length) {
    return '';
  }

  return args
    .map((arg) => {
      if (arg.value !== undefined) {
        return typeof arg.value === 'string' ? arg.value : JSON.stringify(arg.value);
      }
      if (arg.description) {
        return arg.description;
      }
      return arg.type ?? '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

export const agentBrowserBackend = new AgentBrowserBackend();
