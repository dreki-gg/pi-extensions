import { client, v2 } from '@datadog/datadog-api-client';
import type { DatadogCredentials, DatadogProjectConfig } from './config.js';

export interface LogSearchParams {
  query: string;
  from?: string;
  to?: string;
  limit?: number;
  sort?: 'newest' | 'oldest';
  service?: string;
  env?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  status: string;
  service: string;
  host: string;
  message: string;
  tags: string[];
  attributes: Record<string, unknown>;
}

export interface LogSearchResult {
  logs: LogEntry[];
  totalCount: number;
  query: string;
  from: string;
  to: string;
  cursor?: string;
}

/**
 * Parses a relative time string (e.g. "15m", "1h", "7d") into a Date.
 * Returns null if the string is not a recognized relative format.
 */
export function parseRelativeTime(input: string): Date | null {
  const match = input.match(/^(\d+)([mhd])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() - amount * multipliers[unit]);
}

/**
 * Resolves a time input to a Date.
 * Accepts: relative ("15m", "1h"), ISO 8601, or "now".
 */
export function resolveTime(input: string): Date {
  if (input === 'now') return new Date();

  const relative = parseRelativeTime(input);
  if (relative) return relative;

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Invalid time format: "${input}". Use relative (15m, 1h, 7d), ISO 8601, or "now".`,
    );
  }
  return date;
}

/**
 * Builds the full Datadog query by merging the user query with config defaults.
 */
export function buildQuery(
  params: LogSearchParams,
  config: DatadogProjectConfig,
): string {
  const parts: string[] = [params.query];

  const service = params.service ?? config.service;
  if (service && !params.query.includes('service:')) {
    parts.push(`service:${service}`);
  }

  const env = params.env ?? config.env;
  if (env && !params.query.includes('env:')) {
    parts.push(`env:${env}`);
  }

  if (config.defaultTags) {
    for (const tag of config.defaultTags) {
      const tagKey = tag.split(':')[0];
      if (!params.query.includes(`${tagKey}:`)) {
        parts.push(tag);
      }
    }
  }

  return parts.join(' ');
}

function createApiInstance(
  credentials: DatadogCredentials,
  site: string,
): v2.LogsApi {
  const configuration = client.createConfiguration({
    authMethods: {
      apiKeyAuth: credentials.apiKey,
      appKeyAuth: credentials.appKey,
    },
  });
  configuration.setServerVariables({ site });

  return new v2.LogsApi(configuration);
}

function normalizeLogEntry(log: v2.Log): LogEntry {
  const attrs = log.attributes;
  return {
    id: log.id ?? 'unknown',
    timestamp: attrs?.timestamp?.toISOString() ?? 'unknown',
    status: attrs?.status ?? 'unknown',
    service: attrs?.service ?? 'unknown',
    host: attrs?.host ?? 'unknown',
    message: attrs?.message ?? '',
    tags: attrs?.tags ?? [],
    attributes: (attrs?.attributes as Record<string, unknown>) ?? {},
  };
}

/**
 * Searches Datadog logs using the v2 API.
 */
export async function searchLogs(
  params: LogSearchParams,
  config: DatadogProjectConfig,
  credentials: DatadogCredentials,
): Promise<LogSearchResult> {
  const fullQuery = buildQuery(params, config);
  const fromTime = resolveTime(params.from ?? config.defaultTimeRange);
  const toTime = resolveTime(params.to ?? 'now');
  const limit = Math.min(params.limit ?? 25, 100);
  const sortOrder =
    params.sort === 'oldest' ? 'timestamp' : '-timestamp';

  const api = createApiInstance(credentials, config.site);

  const response = await api.listLogsGet({
    filterQuery: fullQuery,
    filterFrom: fromTime,
    filterTo: toTime,
    pageLimit: limit,
    sort: sortOrder as v2.LogsSort,
  });

  const logs = (response.data ?? []).map(normalizeLogEntry);

  return {
    logs,
    totalCount: logs.length,
    query: fullQuery,
    from: fromTime.toISOString(),
    to: toTime.toISOString(),
    cursor: response.meta?.page?.after,
  };
}
