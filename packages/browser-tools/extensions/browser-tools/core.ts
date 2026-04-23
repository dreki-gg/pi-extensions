import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export type ViewportPreset = 'desktop' | 'mobile';

export type ViewportOptions = {
  preset?: ViewportPreset;
  width?: number;
  height?: number;
};

export type ConsoleEntry = {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'page-error';
  text: string;
  url: string | null;
  timestamp: number;
};

export type BrowserStatus = {
  isOpen: boolean;
  url: string | null;
  viewport: { width: number; height: number } | null;
};

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const IDLE_TIMEOUT_MS = 30_000;
const CHROMIUM_ARGS = [
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
] as const;

function viewportFor(
  preset: ViewportPreset = 'desktop',
  width?: number,
  height?: number,
): { width: number; height: number } {
  const base = preset === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
  return {
    width: width ?? base.width,
    height: height ?? base.height,
  };
}

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private consoleEntries: ConsoleEntry[] = [];
  private static readonly MAX_CONSOLE_ENTRIES = 1000;

  get isOpen(): boolean {
    return Boolean(this.browser && this.page && !this.page.isClosed());
  }

  get currentUrl(): string | null {
    if (!this.page || this.page.isClosed()) return null;
    const url = this.page.url();
    return url || null;
  }

  get currentViewport(): { width: number; height: number } | null {
    if (!this.page || this.page.isClosed()) return null;
    return this.page.viewportSize();
  }

  getStatus(): BrowserStatus {
    return {
      isOpen: this.isOpen,
      url: this.currentUrl,
      viewport: this.currentViewport,
    };
  }

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      void this.close();
    }, IDLE_TIMEOUT_MS);
  }

  async ensureBrowser(): Promise<Page> {
    this.resetIdleTimer();

    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    await this.close();

    this.browser = await chromium.launch({
      headless: true,
      args: [...CHROMIUM_ARGS],
    });

    this.context = await this.browser.newContext({
      viewport: { ...DESKTOP_VIEWPORT },
    });

    this.page = await this.context.newPage();
    this.attachConsoleListeners(this.page);
    this.resetIdleTimer();
    return this.page;
  }

  async getPage(viewport?: ViewportOptions): Promise<Page> {
    const page = await this.ensureBrowser();
    if (viewport) {
      await this.setViewport(viewport.preset ?? 'desktop', viewport.width, viewport.height);
    } else {
      this.resetIdleTimer();
    }
    return page;
  }

  async setViewport(
    preset: ViewportPreset = 'desktop',
    width?: number,
    height?: number,
  ): Promise<{ width: number; height: number }> {
    const page = await this.ensureBrowser();
    const viewport = viewportFor(preset, width, height);
    await page.setViewportSize(viewport);
    this.resetIdleTimer();
    return viewport;
  }

  async screenshotToBase64(): Promise<string> {
    const page = await this.ensureBrowser();
    const image = await page.screenshot({ type: 'png' });
    this.resetIdleTimer();
    return image.toString('base64');
  }

  private attachConsoleListeners(page: Page): void {
    page.on('console', (msg) => {
      const rawType = msg.type();
      const level =
        (
          {
            log: 'log',
            info: 'info',
            warning: 'warn',
            error: 'error',
            debug: 'debug',
            trace: 'trace',
          } as Record<string, ConsoleEntry['level']>
        )[rawType] ?? 'log';

      this.pushConsoleEntry({
        level,
        text: msg.text(),
        url: page.isClosed() ? null : page.url(),
        timestamp: Date.now(),
      });
    });

    page.on('pageerror', (error) => {
      this.pushConsoleEntry({
        level: 'page-error',
        text: error.message,
        url: page.isClosed() ? null : page.url(),
        timestamp: Date.now(),
      });
    });
  }

  private pushConsoleEntry(entry: ConsoleEntry): void {
    this.consoleEntries.push(entry);
    if (this.consoleEntries.length > BrowserSession.MAX_CONSOLE_ENTRIES) {
      this.consoleEntries = this.consoleEntries.slice(-BrowserSession.MAX_CONSOLE_ENTRIES);
    }
  }

  getConsoleEntries(options?: {
    level?: ConsoleEntry['level'][];
    clear?: boolean;
  }): ConsoleEntry[] {
    let entries = this.consoleEntries;
    if (options?.level?.length) {
      const allowed = new Set(options.level);
      entries = entries.filter((e) => allowed.has(e.level));
    }
    if (options?.clear) {
      this.consoleEntries = [];
    }
    return entries;
  }

  clearConsoleEntries(): void {
    this.consoleEntries = [];
  }

  async close(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const page = this.page;
    const context = this.context;
    const browser = this.browser;

    this.page = null;
    this.context = null;
    this.browser = null;

    try {
      if (page && !page.isClosed()) await page.close();
    } catch {
      // Ignore cleanup failures.
    }

    try {
      if (context) await context.close();
    } catch {
      // Ignore cleanup failures.
    }

    try {
      if (browser) await browser.close();
    } catch {
      // Ignore cleanup failures.
    }
  }
}

export const browserSession = new BrowserSession();
