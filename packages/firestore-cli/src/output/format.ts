import type { CollectionInfo, DocumentResult, QueryResult } from '../commands/ops-list.js';
import type { WhereClause } from '../commands/where.js';

const MAX_DATA_LENGTH = 500;
const MAX_DEPTH = 3;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function pruneDepth(value: unknown, depth: number): unknown {
  if (depth >= MAX_DEPTH) return '[…]';
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => pruneDepth(v, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = pruneDepth(v, depth + 1);
  }
  return result;
}

function safeStringify(obj: Record<string, unknown>, maxLength: number): string {
  return truncate(JSON.stringify(pruneDepth(obj, 0), null, 2), maxLength);
}

export function formatDocumentResult(doc: DocumentResult): string {
  const lines = [`### \`${doc.id}\``, `**Path:** \`${doc.path}\``];
  if (doc.createTime) lines.push(`**Created:** ${doc.createTime}`);
  if (doc.updateTime) lines.push(`**Updated:** ${doc.updateTime}`);
  lines.push(`**Data:**\n\`\`\`json\n${safeStringify(doc.data, MAX_DATA_LENGTH)}\n\`\`\``);
  return lines.join('\n');
}

export function formatCollectionList(collections: CollectionInfo[]): string {
  if (collections.length === 0) return 'No collections found.';
  const lines = [`## Firestore Collections (${collections.length})`, ''];
  for (const col of collections) {
    lines.push(`- \`${col.id}\` — path: \`${col.path}\``);
  }
  return lines.join('\n');
}

export function formatCountResult(
  collection: string,
  count: number,
  filters?: WhereClause[],
): string {
  const lines = [`## Document Count: \`${collection}\``, '', `**Count:** ${count}`];
  if (filters && filters.length > 0) {
    lines.push('**Filters:**');
    for (const f of filters) {
      lines.push(`- \`${f.field}\` ${f.op} \`${JSON.stringify(f.value)}\``);
    }
  }
  return lines.join('\n');
}

export function formatQueryResult(result: QueryResult): string {
  const lines = [
    '## Firestore Query Results',
    '',
    `**Collection:** \`${result.collection}\``,
    `**Results:** ${result.totalReturned} documents returned`,
  ];
  if (result.hasMore) {
    lines.push(
      `**Pagination:** more results available${result.lastDocId ? ` (startAfter: \`${result.lastDocId}\`)` : ''}`,
    );
  }
  lines.push('');
  if (result.documents.length === 0) {
    lines.push('No documents found matching the query.');
    return lines.join('\n');
  }
  lines.push('---', '');
  for (let i = 0; i < result.documents.length; i++) {
    lines.push(formatDocumentResult(result.documents[i]));
    if (i < result.documents.length - 1) lines.push('');
  }
  return lines.join('\n');
}
