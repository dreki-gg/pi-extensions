import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';
import {
  type FirestoreProjectConfig,
  loadProjectConfig,
  getConfigStatus,
} from './config.js';
import {
  listCollections,
  queryDocuments,
  getDocument,
  countDocuments,
  VALID_OPS,
  type WhereClause,
  type OrderByClause,
} from './client.js';
import {
  formatCollectionList,
  formatQueryResult,
  formatDocumentResult,
  formatCountResult,
  formatRelationMap,
  formatQuerySummary,
} from './format.js';
import { buildRelationMap } from './relations.js';

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIRECTION_ENUM = ['asc', 'desc'] as const;

const TOOL_GUIDELINES = [
  'Use `firestore_list_collections` first to discover available collections before querying.',
  'Use `firestore_count` before querying large collections to understand the data volume.',
  'Use `firestore_query` with where filters to narrow down results — avoid fetching entire collections.',
  'Use `firestore_get_document` when you know the exact document path (e.g. `users/abc123`).',
  'Use `firestore_relation_map` to understand how collections relate to each other — helpful for debugging consistency issues.',
  'Auto-apply `defaultCollection` from `.pi/firestore.json` when the user doesn\'t specify a collection.',
  'For pagination, use `startAfter` with the `lastDocId` from a previous query result.',
];

// ─── Firebase Init ───────────────────────────────────────────────────────────

async function initFirestore(
  config: FirestoreProjectConfig,
  cwd: string,
): Promise<Firestore> {
  const saPath = join(cwd, config.serviceAccountKeyPath);
  const saContent = await readFile(saPath, 'utf-8');
  const serviceAccount = JSON.parse(saContent);

  const app: App = initializeApp({
    credential: cert(serviceAccount),
    projectId: config.projectId,
  });

  return getFirestore(app);
}

// ─── Error helpers ───────────────────────────────────────────────────────────

function notConfiguredError() {
  return {
    content: [
      {
        type: 'text' as const,
        text: '❌ Firestore not configured. Create `.pi/firestore.json` with `projectId` and `serviceAccountKeyPath`.',
      },
    ],
    details: { error: 'not_configured' } as Record<string, unknown>,
    isError: true,
  };
}

function apiError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [
      { type: 'text' as const, text: `❌ Firestore error: ${message}` },
    ],
    details: { error: 'api_error', message } as Record<string, unknown>,
    isError: true,
  };
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function firestoreExtension(pi: ExtensionAPI) {
  let projectConfig: FirestoreProjectConfig | null = null;
  let db: Firestore | null = null;

  pi.on('session_start', async (_event, ctx) => {
    try {
      projectConfig = await loadProjectConfig(ctx.cwd);
      db = await initFirestore(projectConfig, ctx.cwd);
    } catch (err) {
      ctx.ui.notify(
        `Firestore config error: ${(err as Error).message}`,
        'warning',
      );
      projectConfig = null;
      db = null;
    }
  });

  // ─── Tool: List Collections ──────────────────────────────────────────────

  pi.registerTool({
    name: 'firestore_list_collections',
    label: 'Firestore List Collections',
    description:
      'List Firestore collections. Omit path for top-level collections, or provide a document path to list subcollections.',
    promptSnippet: 'List Firestore collections or subcollections of a document',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({
          description:
            'Document path to list subcollections (e.g. "users/abc123"). Omit for top-level collections.',
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: { path?: string },
    ) {
      if (!db) return notConfiguredError();

      try {
        const collections = await listCollections(db, params.path);
        const formatted = formatCollectionList(collections);

        return {
          content: [{ type: 'text' as const, text: formatted }],
          details: {
            count: collections.length,
            parentPath: params.path ?? '(root)',
          } as Record<string, unknown>,
        };
      } catch (err) {
        return apiError(err);
      }
    },
  });

  // ─── Tool: Query Documents ───────────────────────────────────────────────

  pi.registerTool({
    name: 'firestore_query',
    label: 'Firestore Query',
    description:
      'Query Firestore documents with where filters, ordering, limit, and pagination.',
    promptSnippet: 'Query Firestore documents with filters and pagination',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      collection: Type.String({
        description:
          'Collection path (e.g. "users" or "users/abc123/orders")',
      }),
      where: Type.Optional(
        Type.Array(
          Type.Object({
            field: Type.String({ description: 'Field name' }),
            op: StringEnum([...VALID_OPS], {
              description: 'Comparison operator',
            }),
            value: Type.Unknown({ description: 'Value to compare against' }),
          }),
          { description: 'Filter conditions' },
        ),
      ),
      orderBy: Type.Optional(
        Type.Object({
          field: Type.String({ description: 'Field to sort by' }),
          direction: StringEnum(DIRECTION_ENUM, {
            description: 'Sort direction',
          }),
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: 'Max documents to return (1-100). Default 25.',
          minimum: 1,
          maximum: 100,
        }),
      ),
      startAfter: Type.Optional(
        Type.String({
          description:
            'Document ID to start after (for pagination). Use lastDocId from previous result.',
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: {
        collection: string;
        where?: WhereClause[];
        orderBy?: OrderByClause;
        limit?: number;
        startAfter?: string;
      },
    ) {
      if (!db) return notConfiguredError();

      try {
        const result = await queryDocuments(db, params);
        const formatted = formatQueryResult(result);
        const summary = formatQuerySummary(result);

        return {
          content: [{ type: 'text' as const, text: formatted }],
          details: summary as Record<string, unknown>,
        };
      } catch (err) {
        return apiError(err);
      }
    },
  });

  // ─── Tool: Get Document ──────────────────────────────────────────────────

  pi.registerTool({
    name: 'firestore_get_document',
    label: 'Firestore Get Document',
    description:
      'Get a single Firestore document by its full path. Also lists subcollections.',
    promptSnippet: 'Get a Firestore document by path',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      path: Type.String({
        description:
          'Full document path (e.g. "users/abc123", "users/abc/orders/xyz")',
      }),
    }),

    async execute(
      _toolCallId: string,
      params: { path: string },
    ) {
      if (!db) return notConfiguredError();

      try {
        const doc = await getDocument(db, params.path);
        const formatted = formatDocumentResult(doc);

        const subcollectionInfo =
          doc.subcollections.length > 0
            ? `\n\n**Subcollections:** ${doc.subcollections.map((s) => `\`${s.id}\``).join(', ')}`
            : '';

        return {
          content: [
            {
              type: 'text' as const,
              text: formatted + subcollectionInfo,
            },
          ],
          details: {
            id: doc.id,
            path: doc.path,
            subcollections: doc.subcollections.map((s) => s.id),
          } as Record<string, unknown>,
        };
      } catch (err) {
        return apiError(err);
      }
    },
  });

  // ─── Tool: Count Documents ───────────────────────────────────────────────

  pi.registerTool({
    name: 'firestore_count',
    label: 'Firestore Count',
    description:
      'Count documents in a Firestore collection with optional filters.',
    promptSnippet: 'Count documents in a Firestore collection',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      collection: Type.String({
        description: 'Collection path (e.g. "users")',
      }),
      where: Type.Optional(
        Type.Array(
          Type.Object({
            field: Type.String({ description: 'Field name' }),
            op: StringEnum([...VALID_OPS], {
              description: 'Comparison operator',
            }),
            value: Type.Unknown({ description: 'Value to compare against' }),
          }),
          { description: 'Filter conditions' },
        ),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: { collection: string; where?: WhereClause[] },
    ) {
      if (!db) return notConfiguredError();

      try {
        const count = await countDocuments(
          db,
          params.collection,
          params.where,
        );
        const formatted = formatCountResult(
          params.collection,
          count,
          params.where,
        );

        return {
          content: [{ type: 'text' as const, text: formatted }],
          details: {
            collection: params.collection,
            count,
            hasFilters: Boolean(params.where?.length),
          } as Record<string, unknown>,
        };
      } catch (err) {
        return apiError(err);
      }
    },
  });

  // ─── Tool: Relation Map ──────────────────────────────────────────────────

  pi.registerTool({
    name: 'firestore_relation_map',
    label: 'Firestore Relation Map',
    description:
      'Build a relation map between Firestore collections by scanning the codebase and analyzing document fields.',
    promptSnippet:
      'Map relationships between Firestore collections using code analysis and field detection',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: Type.Object({
      collections: Type.Optional(
        Type.Array(Type.String(), {
          description:
            'Specific collections to analyze. Omit to analyze all top-level collections.',
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: { collections?: string[] },
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      if (!db || !projectConfig) return notConfiguredError();

      const cwd = ctx?.cwd ?? process.cwd();

      try {
        const map = await buildRelationMap(
          db,
          cwd,
          projectConfig,
          params.collections,
        );
        const formatted = formatRelationMap(map);

        return {
          content: [{ type: 'text' as const, text: formatted }],
          details: {
            collectionsAnalyzed: map.collections.length,
            relationshipsFound: map.relationships.length,
          } as Record<string, unknown>,
        };
      } catch (err) {
        return apiError(err);
      }
    },
  });

  // ─── Command: /firestore ─────────────────────────────────────────────────

  pi.registerCommand('firestore', {
    description: 'Show Firestore configuration and connection status',
    handler: async (
      _args: string,
      ctx: {
        cwd: string;
        hasUI: boolean;
        ui: {
          notify(message: string, level: 'info' | 'warning' | 'error'): void;
        };
      },
    ) => {
      const config =
        projectConfig ??
        (await loadProjectConfig(ctx.cwd).catch(() => null));
      const status = getConfigStatus(config);

      const lines: string[] = ['Firestore Extension Status', ''];

      lines.push(
        `Config: ${status.hasConfig ? '✅ Loaded' : '❌ Missing (.pi/firestore.json)'}`,
      );
      lines.push(
        `Service Account: ${status.hasServiceAccount ? '✅ Configured' : '❌ Missing'}`,
      );
      lines.push(
        `Project ID: ${status.projectId ?? '(not set)'}`,
      );
      lines.push(
        `Default Collection: ${status.defaultCollection ?? '(not set)'}`,
      );
      lines.push('');
      lines.push(`Firestore Client: ${db ? '✅ Connected' : '❌ Not initialized'}`);

      if (db) {
        try {
          const collections = await listCollections(db);
          lines.push('');
          lines.push(
            `Top-level collections (${collections.length}): ${collections.map((c) => c.id).join(', ') || '(none)'}`,
          );
        } catch {
          lines.push('');
          lines.push('Could not list collections.');
        }
      }

      if (ctx.hasUI) {
        ctx.ui.notify(lines.join('\n'), 'info');
      }
    },
  });
}
