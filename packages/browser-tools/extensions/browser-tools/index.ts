import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { StringEnum } from '@mariozechner/pi-ai';
import { Type } from 'typebox';
import {
  ensureSelectedBrowserBackendAvailable,
  getSelectedBrowserBackend,
  getSelectedBrowserBackendName,
} from './backends/select.js';
import type { ConsoleEntry, ViewportPreset } from './backends/types.js';
import { fetchAsMarkdown, renderedPageToMarkdown } from './markdown.js';
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

const browserBackend = getSelectedBrowserBackend();
const selectedBrowserBackendName = getSelectedBrowserBackendName();
const VIEWPORT_ENUM = ['desktop', 'mobile'] as const;
const ACTION_ENUM = ['click', 'type', 'scroll', 'select', 'hover', 'wait'] as const;
const SCROLL_DIRECTION_ENUM = ['up', 'down'] as const;
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
  method: 'fetch' | typeof selectedBrowserBackendName;
  url: string;
}): string {
  const header = [`Source: ${result.url}`, `Method: ${result.method}`].join('\n');
  return `${header}\n\n${result.markdown}`.trim();
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
      'Fetch a URL and convert it to readable markdown, with optional browser rendering.',
    promptSnippet: 'Fetch a URL and convert it to readable markdown',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      url: Type.String({ description: 'URL to fetch' }),
      render: Type.Optional(Type.Boolean({ description: 'Force browser rendering' })),
    }),
    async execute(
      _toolCallId: string,
      params: { url: string; render?: boolean },
      signal?: AbortSignal,
    ) {
      await ensureSelectedBrowserBackendAvailable();

      const result = params.render
        ? renderedPageToMarkdown(await browserBackend.renderPage(params.url))
        : await fetchAsMarkdown(params.url, { signal });

      const finalResult =
        !params.render && result.markdown.trim().length < 200 && !browserBackend.isOpen()
          ? renderedPageToMarkdown(await browserBackend.renderPage(params.url))
          : result;

      return {
        content: [{ type: 'text', text: formatVisitMarkdown(finalResult) }],
        details: {
          method: finalResult.method,
          backend: selectedBrowserBackendName,
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
      await ensureSelectedBrowserBackendAvailable();

      const screenshot = await browserBackend.screenshot({
        url: params.url,
        preset: (params.viewport ?? 'desktop') as ViewportPreset,
        width: params.width,
        height: params.height,
        waitMs: 1500,
      });

      return {
        content: [
          {
            type: 'image',
            data: screenshot.imageBase64,
            mimeType: 'image/png',
          },
        ],
        details: {
          backend: selectedBrowserBackendName,
          url: screenshot.url,
          viewport: screenshot.viewport,
        },
      };
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
      await ensureSelectedBrowserBackendAvailable();

      if (!browserBackend.isOpen()) {
        throw new Error(
          'Browser is not open. Use web_screenshot or web_visit with render:true first.',
        );
      }

      const interaction = await browserBackend.interact(params);
      const screenshot = await browserBackend.screenshot();

      return {
        content: [
          {
            type: 'text',
            text: `Action completed: ${params.action}`,
          },
          {
            type: 'image',
            data: screenshot.imageBase64,
            mimeType: 'image/png',
          },
        ],
        details: {
          action: params.action,
          backend: selectedBrowserBackendName,
          url: interaction.url ?? screenshot.url,
          viewport: interaction.viewport ?? screenshot.viewport,
        },
      };
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
      await ensureSelectedBrowserBackendAvailable();

      const entries = await browserBackend.getConsoleEntries({
        level: params.level,
        clear: params.clear,
      });

      if (entries.length === 0) {
        const reason = !browserBackend.isOpen()
          ? 'Browser is not open. Use web_screenshot or web_visit with render:true first.'
          : 'No console output captured yet.';
        return {
          content: [{ type: 'text', text: reason }],
          details: {
            count: 0,
            levels: {},
            cleared: params.clear ?? false,
            backend: selectedBrowserBackendName,
          },
        };
      }

      const formatted = entries
        .map((entry) => {
          const tag = entry.level.toUpperCase().padEnd(10);
          return `[${tag}] ${entry.text}`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: formatted }],
        details: {
          count: entries.length,
          levels: Object.fromEntries(
            CONSOLE_LEVEL_ENUM.map((level) => [
              level,
              entries.filter((entry) => entry.level === level).length,
            ]).filter(([, count]) => (count as number) > 0),
          ),
          cleared: params.clear ?? false,
          backend: selectedBrowserBackendName,
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
      await ensureSelectedBrowserBackendAvailable();

      const status = browserBackend.getStatus();
      const message = status.isOpen
        ? `Browser open (${selectedBrowserBackendName})\nURL: ${status.url ?? 'unknown'}\nViewport: ${status.viewport?.width ?? '?'}x${status.viewport?.height ?? '?'}`
        : `Browser closed (${selectedBrowserBackendName} selected)`;

      if (ctx.hasUI) {
        ctx.ui.notify(message, 'info');
      }
    },
  });

  pi.on('session_shutdown', async () => {
    await browserBackend.close();
  });
}
