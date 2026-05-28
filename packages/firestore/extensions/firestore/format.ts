import type {
  DocumentResult,
  QueryResult,
  CollectionInfo,
  WhereClause,
} from './client.js';
import type { RelationMap } from './relations.js';

const MAX_DATA_LENGTH = 500;
const MAX_DEPTH = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Stringifies an object, truncating nested depth beyond MAX_DEPTH.
 */
function safeStringify(
  obj: Record<string, unknown>,
  maxLength: number,
): string {
  const pruned = pruneDepth(obj, 0);
  return truncate(JSON.stringify(pruned, null, 2), maxLength);
}

function pruneDepth(value: unknown, depth: number): unknown {
  if (depth >= MAX_DEPTH) return '[…]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => pruneDepth(v, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = pruneDepth(v, depth + 1);
  }
  return result;
}

// ─── Document ────────────────────────────────────────────────────────────────

export function formatDocumentResult(doc: DocumentResult): string {
  const lines: string[] = [];

  lines.push(`### 📄 \`${doc.id}\``);
  lines.push(`**Path:** \`${doc.path}\``);

  if (doc.createTime) lines.push(`**Created:** ${doc.createTime}`);
  if (doc.updateTime) lines.push(`**Updated:** ${doc.updateTime}`);

  const dataStr = safeStringify(doc.data, MAX_DATA_LENGTH);
  lines.push(`**Data:**\n\`\`\`json\n${dataStr}\n\`\`\``);

  return lines.join('\n');
}

// ─── Query ───────────────────────────────────────────────────────────────────

export function formatQueryResult(result: QueryResult): string {
  const lines: string[] = [];

  lines.push('## Firestore Query Results');
  lines.push('');
  lines.push(`**Collection:** \`${result.collection}\``);
  lines.push(`**Results:** ${result.totalReturned} documents returned`);

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

  lines.push('---');
  lines.push('');

  for (let i = 0; i < result.documents.length; i++) {
    lines.push(formatDocumentResult(result.documents[i]));
    if (i < result.documents.length - 1) lines.push('');
  }

  return lines.join('\n');
}

// ─── Collections ─────────────────────────────────────────────────────────────

export function formatCollectionList(collections: CollectionInfo[]): string {
  if (collections.length === 0) {
    return 'No collections found.';
  }

  const lines: string[] = [];
  lines.push(`## Firestore Collections (${collections.length} collections)`);
  lines.push('');

  for (const col of collections) {
    lines.push(`- \`${col.id}\` — path: \`${col.path}\``);
  }

  return lines.join('\n');
}

// ─── Count ───────────────────────────────────────────────────────────────────

export function formatCountResult(
  collection: string,
  count: number,
  filters?: WhereClause[],
): string {
  const lines: string[] = [];
  lines.push(`## Document Count: \`${collection}\``);
  lines.push('');
  lines.push(`**Count:** ${count}`);

  if (filters && filters.length > 0) {
    lines.push('**Filters:**');
    for (const f of filters) {
      lines.push(`- \`${f.field}\` ${f.op} \`${JSON.stringify(f.value)}\``);
    }
  }

  return lines.join('\n');
}

// ─── Relation Map ────────────────────────────────────────────────────────────

export function formatRelationMap(map: RelationMap): string {
  if (map.collections.length === 0) {
    return 'No collections found for relation mapping.';
  }

  const lines: string[] = [];
  lines.push('## Firestore Relation Map');
  lines.push('');

  // Collections as nodes
  lines.push('### Collections');
  for (const col of map.collections) {
    const fields =
      col.sampleFields.length > 0
        ? ` — fields: ${col.sampleFields.map((f) => `\`${f}\``).join(', ')}`
        : '';
    const count =
      col.documentCount !== undefined
        ? ` (${col.documentCount} docs)`
        : '';
    lines.push(`- **${col.id}**${count}${fields}`);
  }

  lines.push('');

  // Relationships as edges
  if (map.relationships.length === 0) {
    lines.push('### Relationships\nNo relationships detected.');
  } else {
    lines.push('### Relationships');
    for (const rel of map.relationships) {
      const icon =
        rel.confidence === 'high'
          ? '🟢'
          : rel.confidence === 'medium'
            ? '🟡'
            : '🔴';
      lines.push(
        `- ${icon} **${rel.from}** → **${rel.to}** (${rel.type}, confidence: ${rel.confidence})`,
      );
      for (const ev of rel.evidence) {
        lines.push(`  - ${ev}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export function formatQuerySummary(result: QueryResult): {
  totalReturned: number;
  collection: string;
  hasMore: boolean;
  fields: string[];
  lastDocId?: string;
} {
  const fieldSet = new Set<string>();
  for (const doc of result.documents) {
    for (const key of Object.keys(doc.data)) {
      fieldSet.add(key);
    }
  }

  return {
    totalReturned: result.totalReturned,
    collection: result.collection,
    hasMore: result.hasMore,
    fields: [...fieldSet],
    lastDocId: result.lastDocId,
  };
}
