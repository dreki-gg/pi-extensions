import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';
import {
  type DatadogProjectConfig,
  getCredentials,
  getCredentialStatus,
  loadProjectConfig,
} from './config.js';
import { searchLogs, describeDatadogError } from './client.js';
import { searchRumEvents } from './rum-client.js';
import { loadDotEnv } from './dotenv.js';
import { formatSearchResult, formatSearchSummary, formatResultDigest } from './format.js';
import {
  formatRumSearchResult,
  formatRumSearchSummary,
  formatRumResultDigest,
} from './rum-format.js';
import { writeResultsFile } from './output.js';

const SORT_ENUM = ['newest', 'oldest'] as const;

const TOOL_GUIDELINES = [
  'Use `datadog_logs_search` to search production logs in Datadog. It uses Datadog query syntax (e.g. `status:error`, `@http.status_code:500`, `service:my-api`).',
  '`datadog_logs_search` auto-applies project defaults for service and environment from `.pi/datadog.json` — only override when the user explicitly asks for a different service or env.',
  'When `datadog_logs_search` returns many results, summarize the patterns (error types, frequency, affected services) instead of listing every log entry.',
  'The inline `datadog_logs_search` output is a compact digest (counts, status breakdown, services). The complete log entries — full messages and attributes — are written to a temp file whose path is in the response. To inspect actual log content (status codes, paths, stack traces), use the `read` tool on that file instead of re-querying.',
  'Use appropriate time ranges with `datadog_logs_search`: "15m" for recent issues, "1h" for general debugging, "24h" or "7d" for trend analysis.',
  "Datadog is rate-limit sensitive: prefer a single narrow, well-scoped `datadog_logs_search` over many broad calls in quick succession. The tool already auto-retries on 429 (honouring Datadog's reset window) — if it still reports a rate limit, wait before retrying rather than firing again immediately.",
];

const RUM_TOOL_GUIDELINES = [
  'Use `datadog_rum_search` to search Datadog RUM (Real User Monitoring) events — user sessions, views, actions, and front-end errors. It uses Datadog RUM query syntax (e.g. `@type:session`, `@type:error`, `@view.url_path:/checkout`, `@session.type:user`).',
  '`datadog_rum_search` defaults to session events (`@type:session`) when your query does not specify `@type`. To inspect other event kinds, include `@type:view`, `@type:action`, or `@type:error` in the query.',
  '`datadog_rum_search` auto-applies project defaults for RUM application, service, and environment from `.pi/datadog.json` — only override when the user explicitly asks for a different application, service, or env.',
  'The inline `datadog_rum_search` output is a compact digest (counts, event-type breakdown, services). The complete events — full attributes, session ids, view URLs — are written to a temp file whose path is in the response. To inspect actual event content, use the `read` tool on that file instead of re-querying.',
  'Use appropriate time ranges with `datadog_rum_search`: "15m" for recent issues, "1h" for general debugging, "24h" or "7d" for trend analysis.',
];

export default function datadogExtension(pi: ExtensionAPI) {
  let projectConfig: DatadogProjectConfig | null = null;

  pi.on('session_start', async (_event, ctx) => {
    // Load project-root .env so DD_API_KEY / DD_APP_KEY defined there are
    // visible. Shell-exported vars still take precedence.
    loadDotEnv(ctx.cwd);
    try {
      projectConfig = await loadProjectConfig(ctx.cwd);
    } catch (err) {
      ctx.ui.notify(`Datadog config error: ${(err as Error).message}`, 'warning');
      projectConfig = null;
    }
  });

  pi.registerTool({
    name: 'datadog_logs_search',
    label: 'Datadog Log Search',
    description:
      'Search Datadog logs with query syntax. Uses project defaults from .pi/datadog.json for service, environment, and time range.',
    promptSnippet: 'Search Datadog logs with query syntax and project-aware defaults',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      query: Type.String({
        description:
          'Datadog log query syntax (e.g. "status:error", "@http.status_code:500", "error connecting to database")',
      }),
      from: Type.Optional(
        Type.String({
          description:
            'Start time — relative (15m, 1h, 7d) or ISO 8601. Defaults to project config or 1h.',
        }),
      ),
      to: Type.Optional(
        Type.String({
          description: 'End time — relative, ISO 8601, or "now". Defaults to "now".',
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: 'Max logs to return (1-100). Default 25.',
          minimum: 1,
          maximum: 100,
        }),
      ),
      sort: Type.Optional(
        StringEnum(SORT_ENUM, {
          description: 'Sort order by timestamp. Default "newest".',
        }),
      ),
      service: Type.Optional(
        Type.String({
          description: 'Service name — overrides project default from .pi/datadog.json.',
        }),
      ),
      env: Type.Optional(
        Type.String({
          description: 'Environment — overrides project default from .pi/datadog.json.',
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: {
        query: string;
        from?: string;
        to?: string;
        limit?: number;
        sort?: (typeof SORT_ENUM)[number];
        service?: string;
        env?: string;
      },
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      // Ensure .env is loaded in case the tool runs before session_start.
      if (ctx?.cwd) loadDotEnv(ctx.cwd);

      const credentials = getCredentials();
      if (!credentials) {
        const status = getCredentialStatus();
        const missing = [
          !status.hasApiKey && 'DD_API_KEY',
          !status.hasAppKey && 'DD_APP_KEY',
        ].filter(Boolean);

        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Missing Datadog credentials: ${missing.join(', ')}.\n\nSet these environment variables to enable Datadog log search.`,
            },
          ],
          details: { error: 'missing_credentials', missing } as Record<string, unknown>,
          isError: true,
        };
      }

      // Reload config if not loaded yet (e.g. tool called before session_start)
      if (!projectConfig && ctx?.cwd) {
        try {
          projectConfig = await loadProjectConfig(ctx.cwd);
        } catch {
          // Use defaults
          projectConfig = { site: 'datadoghq.com', defaultTimeRange: '1h' };
        }
      }

      const config = projectConfig ?? { site: 'datadoghq.com', defaultTimeRange: '1h' };

      try {
        const result = await searchLogs(params, config, credentials);
        const summary = formatSearchSummary(result);

        // Write the full, untruncated results to a temp file the agent can read,
        // and return only a compact digest inline to save tokens.
        let resultsFile: string | undefined;
        if (result.logs.length > 0) {
          try {
            const fullContent = formatSearchResult(result, {
              maxMessageLength: Infinity,
              maxAttributesLength: Infinity,
            });
            resultsFile = await writeResultsFile(fullContent);
          } catch {
            // Non-fatal: digest still carries the summary.
            resultsFile = undefined;
          }
        }

        return {
          content: [{ type: 'text' as const, text: formatResultDigest(result, resultsFile) }],
          details: { ...summary, resultsFile } as Record<string, unknown>,
        };
      } catch (err) {
        const info = describeDatadogError(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ ${info.message}`,
            },
          ],
          details: {
            error: info.isRateLimit ? 'rate_limited' : 'api_error',
            code: info.code,
            message: info.message,
          } as Record<string, unknown>,
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: 'datadog_rum_search',
    label: 'Datadog RUM Search',
    description:
      'Search Datadog RUM events (sessions, views, actions, errors) with RUM query syntax. Defaults to session events and uses project defaults from .pi/datadog.json for RUM application, service, environment, and time range.',
    promptSnippet:
      'Search Datadog RUM events (sessions/views/actions/errors) with project-aware defaults',
    promptGuidelines: RUM_TOOL_GUIDELINES,
    parameters: Type.Object({
      query: Type.String({
        description:
          'Datadog RUM query syntax (e.g. "@type:session", "@type:error", "@view.url_path:/checkout"). Leave empty to list recent sessions.',
      }),
      from: Type.Optional(
        Type.String({
          description:
            'Start time — relative (15m, 1h, 7d) or ISO 8601. Defaults to project config or 1h.',
        }),
      ),
      to: Type.Optional(
        Type.String({
          description: 'End time — relative, ISO 8601, or "now". Defaults to "now".',
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: 'Max events to return (1-100). Default 25.',
          minimum: 1,
          maximum: 100,
        }),
      ),
      sort: Type.Optional(
        StringEnum(SORT_ENUM, {
          description: 'Sort order by timestamp. Default "newest".',
        }),
      ),
      service: Type.Optional(
        Type.String({
          description:
            'Service name — overrides project rumService/service default from .pi/datadog.json.',
        }),
      ),
      env: Type.Optional(
        Type.String({
          description: 'Environment — overrides project default from .pi/datadog.json.',
        }),
      ),
      applicationId: Type.Optional(
        Type.String({
          description:
            'RUM application id (@application.id) — overrides project rumApplicationId default.',
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: {
        query: string;
        from?: string;
        to?: string;
        limit?: number;
        sort?: (typeof SORT_ENUM)[number];
        service?: string;
        env?: string;
        applicationId?: string;
      },
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      // Ensure .env is loaded in case the tool runs before session_start.
      if (ctx?.cwd) loadDotEnv(ctx.cwd);

      const credentials = getCredentials();
      if (!credentials) {
        const status = getCredentialStatus();
        const missing = [
          !status.hasApiKey && 'DD_API_KEY',
          !status.hasAppKey && 'DD_APP_KEY',
        ].filter(Boolean);

        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Missing Datadog credentials: ${missing.join(', ')}.\n\nSet these environment variables to enable Datadog RUM search.`,
            },
          ],
          details: { error: 'missing_credentials', missing } as Record<string, unknown>,
          isError: true,
        };
      }

      // Reload config if not loaded yet (e.g. tool called before session_start)
      if (!projectConfig && ctx?.cwd) {
        try {
          projectConfig = await loadProjectConfig(ctx.cwd);
        } catch {
          projectConfig = { site: 'datadoghq.com', defaultTimeRange: '1h' };
        }
      }

      const config = projectConfig ?? { site: 'datadoghq.com', defaultTimeRange: '1h' };

      try {
        const result = await searchRumEvents(params, config, credentials);
        const summary = formatRumSearchSummary(result);

        // Write the full, untruncated results to a temp file the agent can read,
        // and return only a compact digest inline to save tokens.
        let resultsFile: string | undefined;
        if (result.events.length > 0) {
          try {
            const fullContent = formatRumSearchResult(result, {
              maxAttributesLength: Infinity,
            });
            resultsFile = await writeResultsFile(fullContent, 'rum');
          } catch {
            // Non-fatal: digest still carries the summary.
            resultsFile = undefined;
          }
        }

        return {
          content: [{ type: 'text' as const, text: formatRumResultDigest(result, resultsFile) }],
          details: { ...summary, resultsFile } as Record<string, unknown>,
        };
      } catch (err) {
        const info = describeDatadogError(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ ${info.message}`,
            },
          ],
          details: {
            error: info.isRateLimit ? 'rate_limited' : 'api_error',
            code: info.code,
            message: info.message,
          } as Record<string, unknown>,
          isError: true,
        };
      }
    },
  });

  pi.registerCommand('datadog', {
    description: 'Show Datadog configuration and connection status',
    handler: async (
      _args: string,
      ctx: {
        cwd: string;
        hasUI: boolean;
        ui: { notify(message: string, level: 'info' | 'warning' | 'error'): void };
      },
    ) => {
      loadDotEnv(ctx.cwd);
      const credStatus = getCredentialStatus();
      const config = projectConfig ?? (await loadProjectConfig(ctx.cwd).catch(() => null));

      const lines: string[] = ['Datadog Extension Status', ''];

      // Credentials
      lines.push(`API Key: ${credStatus.hasApiKey ? '✅ Set' : '❌ Missing (DD_API_KEY)'}`);
      lines.push(`App Key: ${credStatus.hasAppKey ? '✅ Set' : '❌ Missing (DD_APP_KEY)'}`);
      lines.push('');

      // Config
      if (config) {
        lines.push('Project Config (.pi/datadog.json):');
        lines.push(`  Site: ${config.site}`);
        lines.push(`  Service: ${config.service ?? '(not set)'}`);
        lines.push(`  Env: ${config.env ?? '(not set)'}`);
        lines.push(`  Default time range: ${config.defaultTimeRange}`);
        if (config.defaultTags?.length) {
          lines.push(`  Default tags: ${config.defaultTags.join(', ')}`);
        }
        lines.push(`  RUM application: ${config.rumApplicationId ?? '(not set)'}`);
        lines.push(`  RUM service: ${config.rumService ?? '(not set)'}`);
      } else {
        lines.push('No .pi/datadog.json found — using defaults.');
      }

      if (ctx.hasUI) {
        ctx.ui.notify(lines.join('\n'), 'info');
      }
    },
  });
}
