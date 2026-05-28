import type { LogEntry, LogSearchResult } from './client.js';

const MAX_MESSAGE_LENGTH = 500;
const MAX_ATTRIBUTES_LENGTH = 300;

/**
 * Truncates a string to the given max length, appending "…" if truncated.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Formats a single log entry as a compact markdown block.
 */
function formatLogEntry(log: LogEntry, index: number): string {
  const statusIcon = getStatusIcon(log.status);
  const header = `### ${index + 1}. ${statusIcon} \`${log.status}\` — ${log.timestamp}`;

  const lines: string[] = [header];

  if (log.service !== 'unknown') lines.push(`**Service:** ${log.service}`);
  if (log.host !== 'unknown') lines.push(`**Host:** ${log.host}`);

  if (log.message) {
    lines.push(`**Message:**\n\`\`\`\n${truncate(log.message, MAX_MESSAGE_LENGTH)}\n\`\`\``);
  }

  const attrKeys = Object.keys(log.attributes);
  if (attrKeys.length > 0) {
    const attrStr = truncate(JSON.stringify(log.attributes, null, 2), MAX_ATTRIBUTES_LENGTH);
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
 * Formats the full search result for LLM consumption.
 */
export function formatSearchResult(result: LogSearchResult): string {
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
    lines.push(formatLogEntry(result.logs[i], i));
    if (i < result.logs.length - 1) lines.push('');
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
