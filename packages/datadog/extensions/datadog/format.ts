import type { LogEntry, LogSearchResult } from './client.js';

const MAX_MESSAGE_LENGTH = 500;
const MAX_ATTRIBUTES_LENGTH = 300;

export interface FormatOptions {
  /** Max message length before truncation. Use Infinity to disable. */
  maxMessageLength?: number;
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

/**
 * Formats a single log entry as a compact markdown block.
 */
function formatLogEntry(log: LogEntry, index: number, opts: Required<FormatOptions>): string {
  const statusIcon = getStatusIcon(log.status);
  const header = `### ${index + 1}. ${statusIcon} \`${log.status}\` — ${log.timestamp}`;

  const lines: string[] = [header];

  if (log.service !== 'unknown') lines.push(`**Service:** ${log.service}`);
  if (log.host !== 'unknown') lines.push(`**Host:** ${log.host}`);

  if (log.message) {
    lines.push(`**Message:**\n\`\`\`\n${truncate(log.message, opts.maxMessageLength)}\n\`\`\``);
  }

  const attrKeys = Object.keys(log.attributes);
  if (attrKeys.length > 0) {
    const attrStr = truncate(JSON.stringify(log.attributes, null, 2), opts.maxAttributesLength);
    lines.push(`**Attributes:**\n\`\`\`json\n${attrStr}\n\`\`\``);
  }

  if (log.tags.length > 0) {
    lines.push(`**Tags:** ${log.tags.map((t) => `\`${t}\``).join(', ')}`);
  }

  return lines.join('\n');
}

function getStatusIcon(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'error' || lower === 'critical' || lower === 'emergency' || lower === 'alert') {
    return '🔴';
  }
  if (lower === 'warn' || lower === 'warning') return '🟡';
  if (lower === 'info' || lower === 'notice') return '🔵';
  return '⚪';
}

/**
 * Formats the search result for LLM consumption.
 *
 * By default messages and attributes are truncated for a concise inline view.
 * Pass `{ maxMessageLength: Infinity, maxAttributesLength: Infinity }` to render
 * the complete, untruncated result (e.g. for writing to a temp file).
 */
export function formatSearchResult(result: LogSearchResult, opts: FormatOptions = {}): string {
  const resolved: Required<FormatOptions> = {
    maxMessageLength: opts.maxMessageLength ?? MAX_MESSAGE_LENGTH,
    maxAttributesLength: opts.maxAttributesLength ?? MAX_ATTRIBUTES_LENGTH,
  };
  const lines: string[] = [];

  lines.push(`## Datadog Log Search Results`);
  lines.push('');
  lines.push(`**Query:** \`${result.query}\``);
  lines.push(`**Time range:** ${result.from} → ${result.to}`);
  lines.push(`**Results:** ${result.totalCount} logs returned`);

  if (result.cursor) {
    lines.push(`**Pagination:** More results available (cursor present)`);
  }

  lines.push('');

  if (result.logs.length === 0) {
    lines.push('No logs found matching the query.');
    return lines.join('\n');
  }

  lines.push('---');
  lines.push('');

  for (let i = 0; i < result.logs.length; i++) {
    lines.push(formatLogEntry(result.logs[i], i, resolved));
    if (i < result.logs.length - 1) lines.push('');
  }

  return lines.join('\n');
}

/**
 * Builds a compact, token-light digest of a search result for inline tool
 * output. The full per-entry detail lives in the temp file referenced by
 * `resultsFile`; this just gives the agent enough to decide whether to read it.
 */
export function formatResultDigest(result: LogSearchResult, resultsFile?: string): string {
  const lines: string[] = [];
  lines.push(
    `## Datadog Log Search — ${result.totalCount} log${result.totalCount === 1 ? '' : 's'}`,
  );
  lines.push(`**Query:** \`${result.query}\``);
  lines.push(`**Time range:** ${result.from} → ${result.to}`);

  if (result.logs.length === 0) {
    lines.push('');
    lines.push('No logs found matching the query.');
    return lines.join('\n');
  }

  const summary = formatSearchSummary(result);
  const breakdown = Object.entries(summary.statusBreakdown)
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
  if (breakdown) lines.push(`**Status:** ${breakdown}`);
  if (summary.services.length > 0) lines.push(`**Services:** ${summary.services.join(', ')}`);
  if (result.cursor) lines.push(`**Pagination:** more results available (cursor present)`);

  if (resultsFile) {
    lines.push('');
    lines.push(
      `📄 **Full results** (complete messages & attributes): \`${resultsFile}\`\nUse the \`read\` tool on this file to view every log entry.`,
    );
  }

  return lines.join('\n');
}

/**
 * Formats a summary of the search result for tool details.
 */
export function formatSearchSummary(result: LogSearchResult): {
  totalCount: number;
  query: string;
  timeRange: { from: string; to: string };
  statusBreakdown: Record<string, number>;
  services: string[];
  hasCursor: boolean;
} {
  const statusBreakdown: Record<string, number> = {};
  const services = new Set<string>();

  for (const log of result.logs) {
    const status = log.status.toLowerCase();
    statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;
    if (log.service !== 'unknown') services.add(log.service);
  }

  return {
    totalCount: result.totalCount,
    query: result.query,
    timeRange: { from: result.from, to: result.to },
    statusBreakdown,
    services: [...services],
    hasCursor: Boolean(result.cursor),
  };
}
