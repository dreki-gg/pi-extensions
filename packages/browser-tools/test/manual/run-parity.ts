import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type ToolResult = {
  content?: Array<{ type?: string; text?: string; data?: string; mimeType?: string }>;
  details?: Record<string, unknown>;
};

type ToolDefinition = {
  name: string;
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<ToolResult>;
};

type ScenarioResult = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  status: 'pass' | 'fail';
  note: string;
  details: Record<string, unknown> | undefined;
  excerpt: string;
};

type FakePi = {
  registerTool: (tool: ToolDefinition) => void;
  registerCommand: (_name: string, _command: unknown) => void;
  on: (event: string, handler: () => Promise<void> | void) => void;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '../..');
const fixtureRoot = resolve(packageRoot, 'test/manual');
const backend = process.env.PI_BROWSER_BACKEND?.trim() || 'playwright';
const port = Number(process.env.PI_BROWSER_TOOLS_PARITY_PORT || '4173');
const host = '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const fixtureUrl = `${baseUrl}/parity-fixture.html`;
const textTarget = 'Toggle state';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function excerptFromResult(result: ToolResult): string {
  const text = result.content
    ?.filter((entry) => entry.type === 'text' && entry.text)
    .map((entry) => entry.text)
    .join('\n\n')
    .trim();

  if (text) {
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  }

  const image = result.content?.find((entry) => entry.type === 'image' && entry.data);
  if (image?.data) {
    return `[image ${image.mimeType ?? 'unknown'} bytes≈${Math.floor(image.data.length * 0.75)}]`;
  }

  return '(no content)';
}

function createFixtureServer() {
  const server = createServer(async (request, response) => {
    const requestPath = new URL(request.url || '/', baseUrl).pathname;
    const relativePath = requestPath === '/' ? '/parity-fixture.html' : requestPath;
    const normalizedPath = relativePath.replace(/^\/+/, '');
    const absolutePath = resolve(fixtureRoot, normalizedPath);

    if (!absolutePath.startsWith(fixtureRoot)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    try {
      const body = await readFile(absolutePath);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': MIME_TYPES[extname(absolutePath)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  return {
    async start() {
      await new Promise<void>((resolveStart, rejectStart) => {
        server.once('error', rejectStart);
        server.listen(port, host, () => {
          server.off('error', rejectStart);
          resolveStart();
        });
      });
    },
    async stop() {
      await new Promise<void>((resolveStop, rejectStop) => {
        server.close((error) => {
          if (error) rejectStop(error);
          else resolveStop();
        });
      });
    },
  };
}

async function createHarness() {
  const tools = new Map<string, ToolDefinition>();
  const handlers = new Map<string, Array<() => Promise<void> | void>>();

  const fakePi: FakePi = {
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
    registerCommand() {
      // Not needed for the parity harness.
    },
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
  };

  const moduleUrl = new URL('../../extensions/browser-tools/index.ts', import.meta.url);
  const extensionModule = await import(moduleUrl.href);
  const extension = (extensionModule.default ?? extensionModule) as (pi: FakePi) => void;
  extension(fakePi);

  async function runTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = tools.get(name);
    assert(tool, `Tool not registered: ${name}`);
    return tool.execute(`${name}-${Date.now()}`, input);
  }

  async function shutdown(): Promise<void> {
    const shutdownHandlers = handlers.get('session_shutdown') ?? [];
    for (const handler of shutdownHandlers) {
      await handler();
    }
  }

  return { runTool, shutdown };
}

async function scenario(
  id: string,
  tool: string,
  input: Record<string, unknown>,
  execute: () => Promise<{ note: string; result: ToolResult }>,
): Promise<ScenarioResult> {
  try {
    const { note, result } = await execute();
    return {
      id,
      tool,
      input,
      status: 'pass',
      note,
      details: result.details,
      excerpt: excerptFromResult(result),
    };
  } catch (error) {
    return {
      id,
      tool,
      input,
      status: 'fail',
      note: error instanceof Error ? error.message : String(error),
      details: undefined,
      excerpt: '(failed)',
    };
  }
}

async function main() {
  const server = createFixtureServer();
  await server.start();

  const harness = await createHarness();
  const results: ScenarioResult[] = [];

  const resetSession = async () => {
    await harness.shutdown();
  };

  const openFixture = async () => {
    return harness.runTool('web_screenshot', { url: fixtureUrl, viewport: 'desktop' });
  };

  try {
    await resetSession();
    results.push(
      await scenario('visit-fetch', 'web_visit', { url: fixtureUrl, render: false }, async () => {
        const result = await harness.runTool('web_visit', { url: fixtureUrl, render: false });
        assert(result.details?.method === 'fetch', 'Expected details.method to be fetch');
        assert(
          excerptFromResult(result).includes('PARITY-FIXTURE-MARKER-2026-04-22'),
          'Expected markdown excerpt to include fixture marker',
        );
        return {
          note: 'Fetch path preserved and readable markdown contained the fixture marker.',
          result,
        };
      }),
    );

    await resetSession();
    results.push(
      await scenario('visit-render', 'web_visit', { url: fixtureUrl, render: true }, async () => {
        const result = await harness.runTool('web_visit', { url: fixtureUrl, render: true });
        assert(result.details?.method === backend, `Expected details.method to be ${backend}`);
        assert(
          String(result.details?.title ?? '').includes('Browser Tools Parity Fixture'),
          'Expected rendered title to match the fixture title',
        );
        return {
          note: 'Rendered markdown used the selected backend and preserved the fixture title.',
          result,
        };
      }),
    );

    await resetSession();
    results.push(
      await scenario(
        'screenshot-desktop',
        'web_screenshot',
        { url: fixtureUrl, viewport: 'desktop' },
        async () => {
          const result = await harness.runTool('web_screenshot', {
            url: fixtureUrl,
            viewport: 'desktop',
          });
          const viewport = result.details?.viewport as
            | { width?: number; height?: number }
            | undefined;
          const image = result.content?.find((entry) => entry.type === 'image' && entry.data);
          assert(image?.data, 'Expected image content from screenshot tool');
          assert(
            viewport?.width === 1280 && viewport.height === 800,
            'Expected desktop viewport 1280x800',
          );
          return {
            note: 'Desktop screenshot returned a PNG payload and the expected viewport.',
            result,
          };
        },
      ),
    );

    await resetSession();
    results.push(
      await scenario(
        'screenshot-mobile',
        'web_screenshot',
        { url: fixtureUrl, viewport: 'mobile' },
        async () => {
          const result = await harness.runTool('web_screenshot', {
            url: fixtureUrl,
            viewport: 'mobile',
          });
          const viewport = result.details?.viewport as
            | { width?: number; height?: number }
            | undefined;
          const image = result.content?.find((entry) => entry.type === 'image' && entry.data);
          assert(image?.data, 'Expected image content from screenshot tool');
          assert(
            viewport?.width === 390 && viewport.height === 844,
            'Expected mobile viewport 390x844',
          );
          return {
            note: 'Mobile screenshot returned a PNG payload and the expected viewport.',
            result,
          };
        },
      ),
    );

    await resetSession();
    await openFixture();
    results.push(
      await scenario('console-before-clear', 'web_console', {}, async () => {
        const result = await harness.runTool('web_console', {});
        const count = Number(result.details?.count ?? 0);
        assert(count >= 3, 'Expected at least 3 console entries before clear');
        assert(
          excerptFromResult(result).includes('fixture:warn ready'),
          'Expected warning output before clear',
        );
        assert(
          excerptFromResult(result).includes('fixture:page-error ready'),
          'Expected page error output before clear',
        );
        return {
          note: 'Open-page console buffer contained the ready log, warning, and page error.',
          result,
        };
      }),
    );

    results.push(
      await scenario('console-after-clear', 'web_console', { clear: true }, async () => {
        const cleared = await harness.runTool('web_console', { clear: true });
        const after = await harness.runTool('web_console', {});
        assert(
          Number(cleared.details?.count ?? 0) >= 1,
          'Expected clear call to return existing entries',
        );
        assert(Number(after.details?.count ?? 0) === 0, 'Expected no entries after clear');
        return {
          note: `Clear returned ${String(cleared.details?.count ?? 0)} entries and the follow-up read was empty.`,
          result: after,
        };
      }),
    );

    await resetSession();
    await openFixture();
    await harness.runTool('web_console', { clear: true });
    results.push(
      await scenario(
        'interact-click-selector',
        'web_interact',
        { action: 'click', selector: '#toggle-button' },
        async () => {
          const result = await harness.runTool('web_interact', {
            action: 'click',
            selector: '#toggle-button',
          });
          const consoleResult = await harness.runTool('web_console', {});
          assert(
            excerptFromResult(consoleResult).includes('fixture:button clicked:on'),
            'Expected click log after selector click',
          );
          return {
            note: 'Selector click completed and emitted the expected button-on console log.',
            result: {
              content: result.content,
              details: {
                ...(result.details ?? {}),
                consoleCount: consoleResult.details?.count,
              },
            },
          };
        },
      ),
    );

    await resetSession();
    await openFixture();
    await harness.runTool('web_console', { clear: true });
    results.push(
      await scenario(
        'interact-type-selector',
        'web_interact',
        { action: 'type', selector: '#name-input', value: 'parity-run' },
        async () => {
          const result = await harness.runTool('web_interact', {
            action: 'type',
            selector: '#name-input',
            value: 'parity-run',
          });
          const consoleResult = await harness.runTool('web_console', {});
          assert(
            excerptFromResult(consoleResult).includes('fixture:input typed:parity-run'),
            'Expected typed-value log after selector type',
          );
          return {
            note: 'Selector type completed and emitted the expected typed-value console log.',
            result: {
              content: result.content,
              details: {
                ...(result.details ?? {}),
                consoleCount: consoleResult.details?.count,
              },
            },
          };
        },
      ),
    );

    await resetSession();
    await openFixture();
    await harness.runTool('web_console', { clear: true });
    results.push(
      await scenario(
        'interact-select-selector',
        'web_interact',
        { action: 'select', selector: '#flavor-select', value: 'beta' },
        async () => {
          const result = await harness.runTool('web_interact', {
            action: 'select',
            selector: '#flavor-select',
            value: 'beta',
          });
          const consoleResult = await harness.runTool('web_console', {});
          assert(
            excerptFromResult(consoleResult).includes('fixture:select changed:beta'),
            'Expected select-change log after selector select',
          );
          return {
            note: 'Selector select completed and emitted the expected select-change console log.',
            result: {
              content: result.content,
              details: {
                ...(result.details ?? {}),
                consoleCount: consoleResult.details?.count,
              },
            },
          };
        },
      ),
    );

    await resetSession();
    await openFixture();
    await harness.runTool('web_console', { clear: true });
    results.push(
      await scenario(
        'interact-click-text',
        'web_interact',
        { action: 'click', text: textTarget },
        async () => {
          const result = await harness.runTool('web_interact', {
            action: 'click',
            text: textTarget,
          });
          const consoleResult = await harness.runTool('web_console', {});
          assert(
            excerptFromResult(consoleResult).includes('fixture:button clicked:on'),
            'Expected click log after text click',
          );
          return {
            note: 'Text-target click resolved the button and emitted the expected click log.',
            result: {
              content: result.content,
              details: {
                ...(result.details ?? {}),
                consoleCount: consoleResult.details?.count,
              },
            },
          };
        },
      ),
    );
  } finally {
    await harness.shutdown();
    await server.stop();
  }

  const summary = {
    backend,
    fixtureUrl,
    generatedAt: new Date().toISOString(),
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
}

await main();
