import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Effect } from 'effect';
import type { OrderByClause, WhereClause } from './client.js';
import { makeRuntimeLayer } from './effects/runtime.js';
import { errorMessage } from './errors.js';
import { FirestoreRegistry } from './firebase/registry.js';
import {
  TOOL_GUIDELINES,
  countParams,
  getDocumentParams,
  listCollectionsParams,
  queryParams,
  relationMapParams,
} from './tools/params.js';
import {
  countDocumentsProgram,
  firestoreStatusProgram,
  getDocumentProgram,
  listCollectionsProgram,
  queryDocumentsProgram,
  relationMapProgram,
  type CountParams,
  type GetDocumentParams,
  type ListCollectionsParams,
  type QueryParams,
  type RelationMapParams,
  type ToolProgramResult,
} from './tools/programs.js';
import { firestoreErrorResult, textResult } from './tools/results.js';

export default function firestoreExtension(pi: ExtensionAPI) {
  const runtimeLayer = makeRuntimeLayer();

  function runFirestore<A, E>(program: Effect.Effect<A, E, FirestoreRegistry>): Promise<A> {
    return Effect.runPromise(program.pipe(Effect.provide(runtimeLayer)));
  }

  async function runTool(program: Effect.Effect<ToolProgramResult, unknown, FirestoreRegistry>) {
    try {
      const result = await runFirestore(program);
      return textResult(result.text, result.details);
    } catch (err) {
      return firestoreErrorResult(err);
    }
  }

  pi.on('session_start', async (_event, ctx) => {
    try {
      await runFirestore(
        Effect.gen(function* () {
          const registry = yield* FirestoreRegistry;
          yield* registry.clear;
          yield* registry.preloadDefault(ctx.cwd);
        }),
      );
    } catch (err) {
      ctx.ui.notify(`Firestore config error: ${errorMessage(err)}`, 'warning');
      await runFirestore(
        Effect.gen(function* () {
          const registry = yield* FirestoreRegistry;
          yield* registry.clear;
        }),
      ).catch(() => undefined);
    }
  });

  pi.registerTool({
    name: 'firestore_list_collections',
    label: 'Firestore List Collections',
    description:
      'List Firestore collections. Omit path for top-level collections, or provide a document path to list subcollections.',
    promptSnippet: 'List Firestore collections or subcollections of a document',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: listCollectionsParams,

    async execute(
      _toolCallId: string,
      params: ListCollectionsParams,
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      return runTool(listCollectionsProgram(ctx?.cwd ?? process.cwd(), params));
    },
  });

  pi.registerTool({
    name: 'firestore_query',
    label: 'Firestore Query',
    description: 'Query Firestore documents with where filters, ordering, limit, and pagination.',
    promptSnippet: 'Query Firestore documents with filters and pagination',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: queryParams,

    async execute(
      _toolCallId: string,
      params: {
        environment?: string;
        collection: string;
        where?: WhereClause[];
        orderBy?: OrderByClause;
        limit?: number;
        startAfter?: string;
      },
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      return runTool(queryDocumentsProgram(ctx?.cwd ?? process.cwd(), params as QueryParams));
    },
  });

  pi.registerTool({
    name: 'firestore_get_document',
    label: 'Firestore Get Document',
    description: 'Get a single Firestore document by its full path. Also lists subcollections.',
    promptSnippet: 'Get a Firestore document by path',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: getDocumentParams,

    async execute(
      _toolCallId: string,
      params: GetDocumentParams,
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      return runTool(getDocumentProgram(ctx?.cwd ?? process.cwd(), params));
    },
  });

  pi.registerTool({
    name: 'firestore_count',
    label: 'Firestore Count',
    description: 'Count documents in a Firestore collection with optional filters.',
    promptSnippet: 'Count documents in a Firestore collection',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: countParams,

    async execute(
      _toolCallId: string,
      params: { environment?: string; collection: string; where?: WhereClause[] },
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      return runTool(countDocumentsProgram(ctx?.cwd ?? process.cwd(), params as CountParams));
    },
  });

  pi.registerTool({
    name: 'firestore_relation_map',
    label: 'Firestore Relation Map',
    description:
      'Build a relation map between Firestore collections by scanning the codebase and analyzing document fields.',
    promptSnippet:
      'Map relationships between Firestore collections using code analysis and field detection',
    promptGuidelines: TOOL_GUIDELINES,
    parameters: relationMapParams,

    async execute(
      _toolCallId: string,
      params: RelationMapParams,
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
    ) {
      return runTool(relationMapProgram(ctx?.cwd ?? process.cwd(), params));
    },
  });

  pi.registerCommand('firestore', {
    description: 'Show Firestore configuration and connection status',
    handler: async (
      args: string,
      ctx: {
        cwd: string;
        hasUI: boolean;
        ui: {
          notify(message: string, level: 'info' | 'warning' | 'error'): void;
        };
      },
    ) => {
      const lines = await runFirestore(firestoreStatusProgram(ctx.cwd, args)).catch((err) => [
        'Firestore Extension Status',
        '',
        `Connection Error: ${errorMessage(err)}`,
      ]);

      if (ctx.hasUI) {
        ctx.ui.notify(lines.join('\n'), 'info');
      }
    },
  });
}
