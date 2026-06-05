import type { RumEvent, RumSearchResult } from './rum-client.js';

const MAX_ATTRIBUTES_LENGTH = 300;

export interface RumFormatOptions {
  /** Max attributes JSON length before truncation. Use Infinity to disable. */
  maxAttributesLength?: number;
}

/**
 * Truncates a string to the given max length, appending "…" if truncated.
 * A maxLength of Infinity disables truncation.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function getTypeIcon(eventType: string): string {
  switch (eventType.toLowerCase()) {
    case 'error':
      return '🔴';
    case 'session':
      return '👤';
    case 'view':
      return '📄';
    case 'action':
      return '🖱️';
    case 'long_task':
    case 'resource':
      return '📦';
    default:
      return '⚪';
  }
}

/** Reads a dotted-ish nested value (e.g. session.id) from the attribute bag. */
function readNested(
  attributes: Record<string, unknown>,
  group: string,
  key: string,
): string | undefined {
  const obj = attributes[group];
  if (typeof obj === 'object' && obj !== null && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return undefined;
}

function formatRumEvent(event: RumEvent, index: number, opts: Required<RumFormatOptions>): string {
  const icon = getTypeIcon(event.eventType);
  const header = `### ${index + 1}. ${icon} \`${event.eventType}\` — ${event.timestamp}`;

  const lines: string[] = [header];

  if (event.service !== 'unknown') lines.push(`**Service:** ${event.service}`);

  const sessionId = readNested(event.attributes, 'session', 'id');
  if (sessionId) lines.push(`**Session:** ${sessionId}`);

  const viewUrl =
    readNested(event.attributes, 'view', 'url') ?? readNested(event.attributes, 'view', 'url_path');
  if (viewUrl) lines.push(`**View:** ${viewUrl}`);

  const attrKeys = Object.keys(event.attributes);
  if (attrKeys.length > 0) {
    const attrStr = truncate(JSON.stringify(event.attributes, null, 2), opts.maxAttributesLength);
    lines.push(`**Attributes:**\n\`\`\`json\n${attrStr}\n\`\`\``);
  }

  if (event.tags.length > 0) {
    lines.push(`**Tags:** ${event.tags.map((t) => `\`${t}\``).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Formats the RUM search result for LLM consumption.
 *
 * By default attributes are truncated for a concise inline view. Pass
 * `{ maxAttributesLength: Infinity }` to render the complete, untruncated
 * result (e.g. for writing to a temp file).
 */
export function formatRumSearchResult(
  result: RumSearchResult,
  opts: RumFormatOptions = {},
): string {
  const resolved: Required<RumFormatOptions> = {
    maxAttributesLength: opts.maxAttributesLength ?? MAX_ATTRIBUTES_LENGTH,
  };
  const lines: string[] = [];

  lines.push(`## Datadog RUM Event Search Results`);
  lines.push('');
  lines.push(`**Query:** \`${result.query}\``);
  lines.push(`**Time range:** ${result.from} → ${result.to}`);
  lines.push(`**Results:** ${result.totalCount} events returned`);

  if (result.cursor) {
    lines.push(`**Pagination:** More results available (cursor present)`);
  }

  lines.push('');

  if (result.events.length === 0) {
    lines.push('No RUM events found matching the query.');
    return lines.join('\n');
  }

  lines.push('---');
  lines.push('');

  for (let i = 0; i < result.events.length; i++) {
    lines.push(formatRumEvent(result.events[i], i, resolved));
    if (i < result.events.length - 1) lines.push('');
  }

  return lines.join('\n');
}

/**
 * Builds a compact, token-light digest of a RUM search result for inline tool
 * output. The full per-entry detail lives in the temp file referenced by
 * `resultsFile`; this just gives the agent enough to decide whether to read it.
 */
export function formatRumResultDigest(result: RumSearchResult, resultsFile?: string): string {
  const lines: string[] = [];
  lines.push(
    `## Datadog RUM Search — ${result.totalCount} RUM event${result.totalCount === 1 ? '' : 's'}`,
  );
  lines.push(`**Query:** \`${result.query}\``);
  lines.push(`**Time range:** ${result.from} → ${result.to}`);

  if (result.events.length === 0) {
    lines.push('');
    lines.push('No RUM events found matching the query.');
    return lines.join('\n');
  }

  const summary = formatRumSearchSummary(result);
  const breakdown = Object.entries(summary.typeBreakdown)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
  if (breakdown) lines.push(`**Types:** ${breakdown}`);
  if (summary.services.length > 0) lines.push(`**Services:** ${summary.services.join(', ')}`);
  if (result.cursor) lines.push(`**Pagination:** more results available (cursor present)`);

  if (resultsFile) {
    lines.push('');
    lines.push(
      `📄 **Full results** (complete event attributes): \`${resultsFile}\`\nUse the \`read\` tool on this file to view every RUM event.`,
    );
  }

  return lines.join('\n');
}

/**
 * Formats a summary of the RUM search result for tool details.
 */
export function formatRumSearchSummary(result: RumSearchResult): {
  totalCount: number;
  query: string;
  timeRange: { from: string; to: string };
  typeBreakdown: Record<string, number>;
  services: string[];
  hasCursor: boolean;
} {
  const typeBreakdown: Record<string, number> = {};
  const services = new Set<string>();

  for (const event of result.events) {
    const type = event.eventType.toLowerCase();
    typeBreakdown[type] = (typeBreakdown[type] ?? 0) + 1;
    if (event.service !== 'unknown') services.add(event.service);
  }

  return {
    totalCount: result.totalCount,
    query: result.query,
    timeRange: { from: result.from, to: result.to },
    typeBreakdown,
    services: [...services],
    hasCursor: Boolean(result.cursor),
  };
}
