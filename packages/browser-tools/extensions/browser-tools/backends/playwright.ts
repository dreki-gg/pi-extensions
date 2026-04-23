import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { Readability } from '@mozilla/readability';
import type {
  BrowserBackend,
  BrowserInteractParams,
  BrowserScreenshotResult,
  BrowserStatus,
  ConsoleEntry,
  RenderedPage,
  ViewportOptions,
  ViewportPreset,
} from './types.js';

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
const ROLE_FALLBACKS = [
  'button',
  'link',
  'textbox',
  'tab',
  'option',
  'menuitem',
  'checkbox',
  'radio',
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

async function resolveLocator(
  page: Page,
  params: {
    selector?: string;
    text?: string;
  },
) {
  if (params.selector) {
    return page.locator(params.selector).first();
  }

  if (!params.text) {
    throw new Error('This action requires either selector or text');
  }

  const exactText = page.getByText(params.text, { exact: true }).first();
  if (await exactText.count()) return exactText;

  const fuzzyText = page.getByText(params.text).first();
  if (await fuzzyText.count()) return fuzzyText;

  for (const role of ROLE_FALLBACKS) {
    const locator = page.getByRole(role, { name: params.text }).first();
    if (await locator.count()) return locator;
  }

  throw new Error(`Could not find element for text: ${params.text}`);
}

class PlaywrightBackend implements BrowserBackend {
  readonly name = 'playwright' as const;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private consoleEntries: ConsoleEntry[] = [];
  private static readonly MAX_CONSOLE_ENTRIES = 1000;

  isOpen(): boolean {
    return Boolean(this.browser && this.page && !this.page.isClosed());
  }

  getStatus(): BrowserStatus {
    return {
      isOpen: this.isOpen(),
      url: this.currentUrl,
      viewport: this.currentViewport,
    };
  }

  async navigate(
    url: string,
    options?: { preset?: ViewportPreset; width?: number; height?: number; waitMs?: number },
  ): Promise<{ url: string; viewport: { width: number; height: number } | null }> {
    return this.runExclusive(async () => {
      const page = await this.getPage({
        preset: options?.preset,
        width: options?.width,
        height: options?.height,
      });
      await this.navigatePage(page, url, options?.waitMs);
      return {
        url: page.url(),
        viewport: page.viewportSize(),
      };
    });
  }

  async setViewport(
    preset: ViewportPreset = 'desktop',
    width?: number,
    height?: number,
  ): Promise<{ width: number; height: number }> {
    return this.runExclusive(() => this.setViewportInternal(preset, width, height));
  }

  async screenshot(options?: {
    url?: string;
    preset?: ViewportPreset;
    width?: number;
    height?: number;
    waitMs?: number;
  }): Promise<BrowserScreenshotResult> {
    return this.runExclusive(async () => {
      const page = await this.getPage({
        preset: options?.preset,
        width: options?.width,
        height: options?.height,
      });

      if (options?.url) {
        await this.navigatePage(page, options.url, options.waitMs);
      }

      const imageBase64 = await this.screenshotToBase64(page);
      return {
        imageBase64,
        url: page.url() || null,
        viewport: page.viewportSize(),
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
      const page = await this.getPage();

      switch (params.action) {
        case 'scroll': {
          const delta = Math.abs(params.amount ?? 500) * (params.direction === 'up' ? -1 : 1);
          await page.mouse.wheel(0, delta);
          break;
        }
        case 'wait': {
          await page.waitForTimeout(params.timeout ?? 1000);
          break;
        }
        case 'click': {
          const locator = await resolveLocator(page, params);
          await locator.click();
          break;
        }
        case 'hover': {
          const locator = await resolveLocator(page, params);
          await locator.hover();
          break;
        }
        case 'type': {
          if (params.value === undefined) throw new Error('type action requires value');
          const locator = await resolveLocator(page, params);
          await locator.click();
          await locator.fill(params.value);
          break;
        }
        case 'select': {
          if (params.value === undefined) throw new Error('select action requires value');
          const locator = await resolveLocator(page, params);
          await locator.selectOption(params.value);
          break;
        }
        default:
          throw new Error(`Unsupported action: ${String(params.action)}`);
      }

      await page.waitForTimeout(500);
      this.resetIdleTimer();

      return {
        url: page.url() || null,
        viewport: page.viewportSize(),
      };
    });
  }

  async getConsoleEntries(options?: {
    level?: ConsoleEntry['level'][];
    clear?: boolean;
  }): Promise<ConsoleEntry[]> {
    return this.runExclusive(async () => {
      let entries = this.consoleEntries;
      if (options?.level?.length) {
        const allowed = new Set(options.level);
        entries = entries.filter((entry) => allowed.has(entry.level));
      }
      if (options?.clear) {
        this.consoleEntries = [];
      }
      return entries;
    });
  }

  async renderPage(url: string): Promise<RenderedPage> {
    return this.runExclusive(async () => {
      const page = await this.getPage();
      await this.navigatePage(page, url, 1500);

      const inPageResult = await page.evaluate(
        ({ readabilitySource }) => {
          const rawHtml = document.documentElement?.innerHTML ?? '';
          let title = document.title ?? '';
          let contentHtml = document.body?.innerHTML ?? '';

          try {
            const ReadabilityCtor = new Function(`return (${readabilitySource});`)();
            const clonedDocument = document.cloneNode(true);
            const parsed = new ReadabilityCtor(clonedDocument).parse?.();
            if (parsed?.title) title = parsed.title;
            if (parsed?.content) contentHtml = parsed.content;
          } catch {
            // Fall back to raw document HTML extraction.
          }

          return {
            rawHtml,
            title,
            contentHtml,
            url: window.location.href,
          };
        },
        { readabilitySource: Readability.toString() },
      );

      this.resetIdleTimer();

      const finalUrl = inPageResult.url || page.url() || url;
      return {
        html: inPageResult.rawHtml,
        contentHtml: inPageResult.contentHtml?.trim() || undefined,
        title: inPageResult.title?.trim() || finalUrl,
        url: finalUrl,
        backend: this.name,
      };
    });
  }

  async close(): Promise<void> {
    return this.runExclusive(() => this.closeInternal());
  }

  private get currentUrl(): string | null {
    if (!this.page || this.page.isClosed()) return null;
    const url = this.page.url();
    return url || null;
  }

  private get currentViewport(): { width: number; height: number } | null {
    if (!this.page || this.page.isClosed()) return null;
    return this.page.viewportSize();
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      void this.close();
    }, IDLE_TIMEOUT_MS);
  }

  private async ensureBrowser(): Promise<Page> {
    this.resetIdleTimer();

    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    await this.closeInternal();

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

  private async getPage(viewport?: ViewportOptions): Promise<Page> {
    const page = await this.ensureBrowser();
    if (viewport) {
      await this.setViewportInternal(viewport.preset ?? 'desktop', viewport.width, viewport.height);
    } else {
      this.resetIdleTimer();
    }
    return page;
  }

  private async setViewportInternal(
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

  private async navigatePage(page: Page, url: string, waitMs = 1500): Promise<void> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(waitMs);
    this.resetIdleTimer();
  }

  private async screenshotToBase64(page: Page): Promise<string> {
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
    if (this.consoleEntries.length > PlaywrightBackend.MAX_CONSOLE_ENTRIES) {
      this.consoleEntries = this.consoleEntries.slice(-PlaywrightBackend.MAX_CONSOLE_ENTRIES);
    }
  }

  private async closeInternal(): Promise<void> {
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

export const playwrightBackend = new PlaywrightBackend();
