import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { StringEnum } from '@mariozechner/pi-ai';
import { Type } from 'typebox';
import { browserSession, type ConsoleEntry, type ViewportPreset } from './core.js';
import { fetchAsMarkdown, renderWithPlaywright } from './markdown.js';
import { webSearch } from './search.js';

const TOOL_GUIDELINES = [
  'Use `web_search` to find information online, then `web_visit` to read specific pages.',
  'Use `web_screenshot` and `web_interact` for visual verification and page interaction.',
  '`web_visit` returns markdown by default without launching a browser. Use `render: true` only for JavaScript-heavy SPAs.',
];
const env =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const VIEWPORT_ENUM = ['desktop', 'mobile'] as const;
const ACTION_ENUM = ['click', 'type', 'scroll', 'select', 'hover', 'wait'] as const;
const SCROLL_DIRECTION_ENUM = ['up', 'down'] as const;
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
const CONSOLE_LEVEL_ENUM = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  'page-error',
] as const;

function formatSearchResults(
  results: Array<{ title: string; url: string; snippet: string }>,
): string {
  if (results.length === 0) return 'No results found.';

  return results
    .map((result, index) => {
      const snippet = result.snippet ? `\n   ${result.snippet}` : '';
      return `${index + 1}. [${result.title}](${result.url})${snippet}`;
    })
    .join('\n\n');
}

function formatVisitMarkdown(result: {
  markdown: string;
  title: string;
  method: 'fetch' | 'playwright';
  url: string;
}): string {
  const header = [`Source: ${result.url}`, `Method: ${result.method}`].join('\n');
  return `${header}\n\n${result.markdown}`.trim();
}

async function resolveLocator(
  page: Awaited<ReturnType<typeof browserSession.getPage>>,
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

export default function browserToolsExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'web_search',
    label: 'Web Search',
    description: 'Search the web and return up to 10 filtered results.',
    promptSnippet: 'Search the web and return a list of results',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      query: Type.String({ description: 'Search query' }),
      allowed_domains: Type.Optional(Type.Array(Type.String({ description: 'Allowed domain' }))),
      blocked_domains: Type.Optional(Type.Array(Type.String({ description: 'Blocked domain' }))),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; allowed_domains?: string[]; blocked_domains?: string[] },
      signal?: AbortSignal,
    ) {
      const result = await webSearch(params.query, {
        allowed_domains: params.allowed_domains,
        blocked_domains: params.blocked_domains,
        signal,
      });

      return {
        content: [{ type: 'text', text: formatSearchResults(result.results) }],
        details: {
          provider: (env.WEB_SEARCH_PROVIDER ?? 'duckduckgo').toLowerCase(),
          results: result.results,
        },
      };
    },
  });

  pi.registerTool({
    name: 'web_visit',
    label: 'Web Visit',
    description:
      'Fetch a URL and convert it to readable markdown, with optional Playwright rendering.',
    promptSnippet: 'Fetch a URL and convert it to readable markdown',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      url: Type.String({ description: 'URL to fetch' }),
      render: Type.Optional(Type.Boolean({ description: 'Force Playwright rendering' })),
    }),
    async execute(
      _toolCallId: string,
      params: { url: string; render?: boolean },
      signal?: AbortSignal,
    ) {
      const result = params.render
        ? await browserSession.runExclusive(() => renderWithPlaywright(browserSession, params.url))
        : await fetchAsMarkdown(params.url, { signal });

      const finalResult =
        !params.render && result.markdown.trim().length < 200 && !browserSession.isOpen
          ? await browserSession.runExclusive(() =>
              renderWithPlaywright(browserSession, params.url),
            )
          : result;

      return {
        content: [{ type: 'text', text: formatVisitMarkdown(finalResult) }],
        details: {
          method: finalResult.method,
          title: finalResult.title,
          url: finalResult.url,
          length: finalResult.markdown.length,
        },
      };
    },
  });

  pi.registerTool({
    name: 'web_screenshot',
    label: 'Web Screenshot',
    description: 'Take a screenshot of the current page or navigate to a URL first.',
    promptSnippet: 'Take a screenshot of a web page at desktop or mobile size',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      url: Type.Optional(Type.String({ description: 'URL to navigate to before capturing' })),
      viewport: Type.Optional(StringEnum(VIEWPORT_ENUM, { description: 'Viewport preset' })),
      width: Type.Optional(Type.Number({ description: 'Viewport width override' })),
      height: Type.Optional(Type.Number({ description: 'Viewport height override' })),
    }),
    async execute(
      _toolCallId: string,
      params: { url?: string; viewport?: ViewportPreset; width?: number; height?: number },
    ) {
      const viewport = (params.viewport ?? 'desktop') as ViewportPreset;

      return browserSession.runExclusive(async () => {
        const page = await browserSession.getPage({
          preset: viewport,
          width: params.width,
          height: params.height,
        });

        const size = await browserSession.setViewport(viewport, params.width, params.height);

        if (params.url) {
          await page.goto(params.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          await page.waitForTimeout(1500);
          browserSession.resetIdleTimer();
        }

        const image = await browserSession.screenshotToBase64();
        return {
          content: [
            {
              type: 'image',
              data: image,
              mimeType: 'image/png',
            },
          ],
          details: {
            url: page.url(),
            viewport: size,
          },
        };
      });
    },
  });

  pi.registerTool({
    name: 'web_interact',
    label: 'Web Interact',
    description: 'Interact with the currently open browser page and return a fresh screenshot.',
    promptSnippet: 'Interact with the current browser page (click, type, scroll, etc.)',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      action: StringEnum(ACTION_ENUM, { description: 'Interaction to perform' }),
      selector: Type.Optional(Type.String({ description: 'CSS selector' })),
      text: Type.Optional(Type.String({ description: 'Visible text to target' })),
      value: Type.Optional(Type.String({ description: 'Value for type/select actions' })),
      direction: Type.Optional(
        StringEnum(SCROLL_DIRECTION_ENUM, { description: 'Scroll direction' }),
      ),
      amount: Type.Optional(Type.Number({ description: 'Scroll amount in pixels' })),
      timeout: Type.Optional(Type.Number({ description: 'Wait timeout in milliseconds' })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        action: (typeof ACTION_ENUM)[number];
        selector?: string;
        text?: string;
        value?: string;
        direction?: (typeof SCROLL_DIRECTION_ENUM)[number];
        amount?: number;
        timeout?: number;
      },
    ) {
      if (!browserSession.isOpen) {
        throw new Error(
          'Browser is not open. Use web_screenshot or web_visit with render:true first.',
        );
      }

      return browserSession.runExclusive(async () => {
        const page = await browserSession.getPage();

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
        browserSession.resetIdleTimer();

        const image = await browserSession.screenshotToBase64();
        return {
          content: [
            {
              type: 'text',
              text: `Action completed: ${params.action}`,
            },
            {
              type: 'image',
              data: image,
              mimeType: 'image/png',
            },
          ],
          details: {
            action: params.action,
            url: page.url(),
            viewport: page.viewportSize(),
          },
        };
      });
    },
  });

  pi.registerTool({
    name: 'web_console',
    label: 'Web Console',
    description:
      'Read browser console output (logs, warnings, errors) from the current page. Captures console.log/info/warn/error/debug/trace and uncaught page errors.',
    promptSnippet: 'Read browser console output (logs, warnings, errors, uncaught exceptions)',
    promptGuidelines: [
      'Use `web_console` to inspect runtime errors, warnings, and log output from the browser.',
      '`web_console` captures output from the moment the browser opens. Use `clear: true` to reset the buffer after reading.',
    ],
    parameters: Type.Object({
      level: Type.Optional(
        Type.Array(
          StringEnum(CONSOLE_LEVEL_ENUM, {
            description: 'Filter by console level',
          }),
          {
            description: 'Only return entries matching these levels. Omit to return all levels.',
          },
        ),
      ),
      clear: Type.Optional(
        Type.Boolean({
          description: 'Clear the console buffer after reading (default false)',
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        level?: ConsoleEntry['level'][];
        clear?: boolean;
      },
    ) {
      const entries = browserSession.getConsoleEntries({
        level: params.level,
        clear: params.clear,
      });

      if (entries.length === 0) {
        const reason = !browserSession.isOpen
          ? 'Browser is not open. Use web_screenshot or web_visit with render:true first.'
          : 'No console output captured yet.';
        return {
          content: [{ type: 'text', text: reason }],
          details: {
            count: 0,
            levels: {},
            cleared: params.clear ?? false,
          },
        };
      }

      const formatted = entries
        .map((e) => {
          const tag = e.level.toUpperCase().padEnd(10);
          return `[${tag}] ${e.text}`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: formatted }],
        details: {
          count: entries.length,
          levels: Object.fromEntries(
            CONSOLE_LEVEL_ENUM.map((l) => [l, entries.filter((e) => e.level === l).length]).filter(
              ([, n]) => (n as number) > 0,
            ),
          ),
          cleared: params.clear ?? false,
        },
      };
    },
  });

  pi.registerCommand('browser', {
    description: 'Show browser status',
    handler: async (
      _args: string,
      ctx: {
        hasUI: boolean;
        ui: { notify(message: string, level: 'info' | 'warning' | 'error'): void };
      },
    ) => {
      const status = browserSession.getStatus();
      const message = status.isOpen
        ? `Browser open\nURL: ${status.url ?? 'unknown'}\nViewport: ${status.viewport?.width ?? '?'}x${status.viewport?.height ?? '?'}`
        : 'Browser closed';

      if (ctx.hasUI) {
        ctx.ui.notify(message, 'info');
      }
    },
  });

  pi.on('session_shutdown', async () => {
    await browserSession.close();
  });
}
