import { v2 } from '@datadog/datadog-api-client';
import type { DatadogCredentials, DatadogProjectConfig } from './config.js';
import { createConfiguration, resolveTime } from './client.js';

export interface RumSearchParams {
  query: string;
  from?: string;
  to?: string;
  limit?: number;
  sort?: 'newest' | 'oldest';
  service?: string;
  env?: string;
  applicationId?: string;
}

export interface RumEvent {
  id: string;
  /** RUM event type (session, view, action, error, …) from the event attributes. */
  eventType: string;
  timestamp: string;
  service: string;
  tags: string[];
  attributes: Record<string, unknown>;
}

export interface RumSearchResult {
  events: RumEvent[];
  totalCount: number;
  query: string;
  from: string;
  to: string;
  cursor?: string;
}

/**
 * Builds the full RUM query by merging the user query with config defaults.
 *
 * Defaults to session events (`@type:session`) unless the query already scopes
 * `@type`, so views/actions/errors stay reachable. Application, service, env,
 * and tag defaults are merged the same way as the logs client, skipping any
 * dimension the user already constrained.
 */
export function buildRumQuery(params: RumSearchParams, config: DatadogProjectConfig): string {
  const parts: string[] = [];
  if (params.query.trim().length > 0) parts.push(params.query);

  if (!params.query.includes('@type:')) {
    parts.push('@type:session');
  }

  const applicationId = params.applicationId ?? config.rumApplicationId;
  if (applicationId && !params.query.includes('@application.id:')) {
    parts.push(`@application.id:${applicationId}`);
  }

  const service = params.service ?? config.rumService ?? config.service;
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

/**
 * Normalizes a raw RUM event from the SDK into a flat, agent-friendly shape.
 */
export function normalizeRumEvent(event: v2.RUMEvent): RumEvent {
  const attrs = event.attributes;
  const nested = (attrs?.attributes as Record<string, unknown> | undefined) ?? {};
  const eventType = typeof nested.type === 'string' ? nested.type : 'unknown';

  return {
    id: event.id ?? 'unknown',
    eventType,
    timestamp: attrs?.timestamp?.toISOString() ?? 'unknown',
    service: attrs?.service ?? 'unknown',
    tags: attrs?.tags ?? [],
    attributes: nested,
  };
}

/**
 * Searches Datadog RUM events using the v2 API.
 */
export async function searchRumEvents(
  params: RumSearchParams,
  config: DatadogProjectConfig,
  credentials: DatadogCredentials,
): Promise<RumSearchResult> {
  const fullQuery = buildRumQuery(params, config);
  const fromTime = resolveTime(params.from ?? config.defaultTimeRange);
  const toTime = resolveTime(params.to ?? 'now');
  const limit = Math.min(params.limit ?? 25, 100);
  const sortOrder = params.sort === 'oldest' ? 'timestamp' : '-timestamp';

  const api = new v2.RUMApi(createConfiguration(credentials, config.site));

  const response = await api.listRUMEvents({
    filterQuery: fullQuery,
    filterFrom: fromTime,
    filterTo: toTime,
    pageLimit: limit,
    sort: sortOrder as v2.RUMSort,
  });

  const events = (response.data ?? []).map(normalizeRumEvent);

  return {
    events,
    totalCount: events.length,
    query: fullQuery,
    from: fromTime.toISOString(),
    to: toTime.toISOString(),
    cursor: response.meta?.page?.after,
  };
}
