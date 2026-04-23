import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertAgentBrowserAvailable,
  runAgentBrowserJson,
  viewportFor,
} from './agent-browser-cli.js';
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
const IDLE_TIMEOUT_MS = 30_000;
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
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private availableChecked = false;
  private suppressedPageErrorCounts = new Map<string, number>();
  private status: BrowserStatus = {
    isOpen: false,
    url: null,
    viewport: null,
  };

  isOpen(): boolean {
    return this.status.isOpen;
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

      const imageBase64 = await this.captureScreenshotBase64();
      await this.refreshUrl(options?.url);

      return {
        imageBase64,
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
      this.resetIdleTimer();
      return;
    }

    await this.openInternal();
  }

  private async ensureReady(): Promise<void> {
    await this.ensureSessionStarted();
    if (!this.status.viewport) {
      await this.setViewportInternal('desktop');
    } else {
      this.resetIdleTimer();
    }
  }

  private async openInternal(url?: string): Promise<void> {
    if (url) {
      await runAgentBrowserJson(['open', url]);
    } else {
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
    this.resetIdleTimer();
    return viewport;
  }

  private async waitForPage(waitMs: number): Promise<void> {
    if (waitMs <= 0) {
      this.resetIdleTimer();
      return;
    }

    await runAgentBrowserJson(['wait', String(waitMs)]);
    this.resetIdleTimer();
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

  private async captureScreenshotBase64(): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), 'pi-browser-tools-agent-browser-'));
    const screenshotPath = join(tempDir, 'screenshot.png');

    try {
      await runAgentBrowserJson(['screenshot', screenshotPath]);
      const png = await readFile(screenshotPath);
      this.resetIdleTimer();
      return png.toString('base64');
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

    const targetText = params.text.trim();
    const snapshot = await runAgentBrowserJson<AgentBrowserSnapshotData>(['snapshot', '-i']);
    if (snapshot.origin?.trim()) {
      this.markOpen(snapshot.origin.trim());
    }

    const refs = Object.entries(snapshot.refs ?? {});
    if (refs.length === 0) {
      throw new Error(`Could not find any interactive elements for text: ${params.text}`);
    }

    const accessibleNameMatches = refs.filter(([, ref]) => ref.name?.trim() === targetText);
    const singleAccessibleMatch = pickSingleMatch(accessibleNameMatches);
    if (singleAccessibleMatch) {
      return singleAccessibleMatch;
    }

    const visibleTextMatches = await this.findVisibleTextMatches(
      accessibleNameMatches.length > 0 ? accessibleNameMatches : refs,
      targetText,
    );
    const singleVisibleTextMatch = pickSingleMatch(visibleTextMatches);
    if (singleVisibleTextMatch) {
      return singleVisibleTextMatch;
    }

    if (accessibleNameMatches.length > 1) {
      throwAmbiguousMatch(accessibleNameMatches, targetText, 'accessible name');
    }

    if (visibleTextMatches.length > 1) {
      throwAmbiguousMatch(visibleTextMatches, targetText, 'visible text');
    }

    throw new Error(
      `Could not resolve a unique interactive element for text: ${params.text}. Try using selector instead.`,
    );
  }

  private async findVisibleTextMatches(
    refs: Array<[string, AgentBrowserSnapshotRef]>,
    targetText: string,
  ): Promise<Array<[string, AgentBrowserSnapshotRef]>> {
    const results = await Promise.all(
      refs.map(async ([refId, ref]) => {
        const text = await this.getVisibleTextForRef(refId);
        return text === targetText ? ([refId, ref] as [string, AgentBrowserSnapshotRef]) : null;
      }),
    );

    return results.filter((entry): entry is [string, AgentBrowserSnapshotRef] => entry !== null);
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
    this.resetIdleTimer();
  }

  private async closeInternal(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const shouldAttemptClose = this.status.isOpen;
    this.status = {
      isOpen: false,
      url: null,
      viewport: null,
    };
    this.resetPageErrorSuppression();

    if (!shouldAttemptClose) {
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

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      void this.close();
    }, IDLE_TIMEOUT_MS);
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

function pickSingleMatch(matches: Array<[string, AgentBrowserSnapshotRef]>): string | null {
  return matches.length === 1 ? `@${matches[0][0]}` : null;
}

function throwAmbiguousMatch(
  matches: Array<[string, AgentBrowserSnapshotRef]>,
  targetText: string,
  matchType: 'accessible name' | 'visible text',
): never {
  const descriptions = matches.map(([refId, ref]) => formatRefDescription(refId, ref));
  throw new Error(
    [
      `Found multiple matches for text "${targetText}" by ${matchType}.`,
      `Matches: ${descriptions.join(', ')}`,
      'Use selector instead to disambiguate.',
    ].join(' '),
  );
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

function formatRefDescription(refId: string, ref: AgentBrowserSnapshotRef): string {
  const role = ref.role?.trim() || 'element';
  const name = ref.name?.trim() || '(unnamed)';
  return `@${refId} (${role}: ${JSON.stringify(name)})`;
}

export const agentBrowserBackend = new AgentBrowserBackend();
