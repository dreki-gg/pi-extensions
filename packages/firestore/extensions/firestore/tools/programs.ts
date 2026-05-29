import { Effect } from 'effect';
import {
  getConfigStatus,
  resolveEnvironmentConfigEffect,
  type FirestoreProjectConfig,
} from '../config.js';
import {
  countDocuments,
  getDocument,
  listCollections,
  queryDocuments,
  type OrderByClause,
  type WhereClause,
} from '../client.js';
import { errorMessage, FirestoreOperationError, type FirestoreExtensionError } from '../errors.js';
import {
  formatCollectionList,
  formatCountResult,
  formatDocumentResult,
  formatQueryResult,
  formatQuerySummary,
  formatRelationMap,
} from '../format.js';
import { buildRelationMap } from '../relations.js';
import { FirestoreRegistry } from '../firebase/registry.js';

export interface ToolProgramResult {
  readonly text: string;
  readonly details: Record<string, unknown>;
}

export interface ListCollectionsParams {
  readonly environment?: string;
  readonly path?: string;
}

export interface QueryParams {
  readonly environment?: string;
  readonly collection: string;
  readonly where?: WhereClause[];
  readonly orderBy?: OrderByClause;
  readonly limit?: number;
  readonly startAfter?: string;
}

export interface GetDocumentParams {
  readonly environment?: string;
  readonly path: string;
}

export interface CountParams {
  readonly environment?: string;
  readonly collection: string;
  readonly where?: WhereClause[];
}

export interface RelationMapParams {
  readonly environment?: string;
  readonly collections?: string[];
}

export function listCollectionsProgram(
  cwd: string,
  params: ListCollectionsParams,
): Effect.Effect<ToolProgramResult, FirestoreExtensionError, FirestoreRegistry> {
  return Effect.gen(function* () {
    const registry = yield* FirestoreRegistry;
    const { db, environment } = yield* registry.get(cwd, params.environment);
    const collections = yield* Effect.tryPromise({
      try: () => listCollections(db, params.path),
      catch: (cause) =>
        new FirestoreOperationError({
          operation: 'list_collections',
          environment: environment.name,
          cause,
        }),
    });

    return {
      text: formatCollectionList(collections),
      details: {
        environment: environment.name,
        projectId: environment.projectId,
        count: collections.length,
        parentPath: params.path ?? '(root)',
      },
    };
  });
}

export function queryDocumentsProgram(
  cwd: string,
  params: QueryParams,
): Effect.Effect<ToolProgramResult, FirestoreExtensionError, FirestoreRegistry> {
  return Effect.gen(function* () {
    const registry = yield* FirestoreRegistry;
    const { db, environment } = yield* registry.get(cwd, params.environment);
    const result = yield* Effect.tryPromise({
      try: () => queryDocuments(db, params),
      catch: (cause) =>
        new FirestoreOperationError({
          operation: 'query',
          environment: environment.name,
          cause,
        }),
    });
    const summary = formatQuerySummary(result);

    return {
      text: formatQueryResult(result),
      details: {
        environment: environment.name,
        projectId: environment.projectId,
        ...summary,
      },
    };
  });
}

export function getDocumentProgram(
  cwd: string,
  params: GetDocumentParams,
): Effect.Effect<ToolProgramResult, FirestoreExtensionError, FirestoreRegistry> {
  return Effect.gen(function* () {
    const registry = yield* FirestoreRegistry;
    const { db, environment } = yield* registry.get(cwd, params.environment);
    const doc = yield* Effect.tryPromise({
      try: () => getDocument(db, params.path),
      catch: (cause) =>
        new FirestoreOperationError({
          operation: 'get_document',
          environment: environment.name,
          cause,
        }),
    });

    const subcollectionInfo =
      doc.subcollections.length > 0
        ? `\n\n**Subcollections:** ${doc.subcollections.map((s) => `\`${s.id}\``).join(', ')}`
        : '';

    return {
      text: formatDocumentResult(doc) + subcollectionInfo,
      details: {
        environment: environment.name,
        projectId: environment.projectId,
        id: doc.id,
        path: doc.path,
        subcollections: doc.subcollections.map((s) => s.id),
      },
    };
  });
}

export function countDocumentsProgram(
  cwd: string,
  params: CountParams,
): Effect.Effect<ToolProgramResult, FirestoreExtensionError, FirestoreRegistry> {
  return Effect.gen(function* () {
    const registry = yield* FirestoreRegistry;
    const { db, environment } = yield* registry.get(cwd, params.environment);
    const count = yield* Effect.tryPromise({
      try: () => countDocuments(db, params.collection, params.where),
      catch: (cause) =>
        new FirestoreOperationError({
          operation: 'count',
          environment: environment.name,
          cause,
        }),
    });

    return {
      text: formatCountResult(params.collection, count, params.where),
      details: {
        environment: environment.name,
        projectId: environment.projectId,
        collection: params.collection,
        count,
        hasFilters: Boolean(params.where?.length),
      },
    };
  });
}

export function relationMapProgram(
  cwd: string,
  params: RelationMapParams,
): Effect.Effect<ToolProgramResult, FirestoreExtensionError, FirestoreRegistry> {
  return Effect.gen(function* () {
    const registry = yield* FirestoreRegistry;
    const { db, environment, config } = yield* registry.get(cwd, params.environment);
    const activeConfig: FirestoreProjectConfig = {
      ...config,
      ...environment,
    };
    const map = yield* Effect.tryPromise({
      try: () => buildRelationMap(db, cwd, activeConfig, params.collections),
      catch: (cause) =>
        new FirestoreOperationError({
          operation: 'relation_map',
          environment: environment.name,
          cause,
        }),
    });

    return {
      text: formatRelationMap(map),
      details: {
        environment: environment.name,
        projectId: environment.projectId,
        collectionsAnalyzed: map.collections.length,
        relationshipsFound: map.relationships.length,
      },
    };
  });
}

export function firestoreStatusProgram(
  cwd: string,
  requestedEnvironment?: string,
): Effect.Effect<string[], never, FirestoreRegistry> {
  return Effect.gen(function* () {
    const registry = yield* FirestoreRegistry;
    const current = yield* registry.currentConfig;
    const loaded = current
      ? { _tag: 'Right' as const, right: current }
      : yield* registry.loadConfig(cwd).pipe(Effect.either);
    const config = loaded._tag === 'Right' ? loaded.right : null;
    const status = getConfigStatus(config);
    const requested = requestedEnvironment?.trim() || status.defaultEnvironment;

    let selectedEnvironment = null as null | {
      readonly name: string;
      readonly projectId: string;
      readonly defaultCollection?: string;
    };
    let selectedDb = null as null | Parameters<typeof listCollections>[0];
    let connectionError: string | null = loaded._tag === 'Left' ? errorMessage(loaded.left) : null;

    if (config && requested) {
      const resolved = yield* registry.get(cwd, requested).pipe(Effect.either);
      if (resolved._tag === 'Right') {
        selectedEnvironment = resolved.right.environment;
        selectedDb = resolved.right.db;
        connectionError = null;
      } else {
        connectionError = errorMessage(resolved.left);
        const environment = yield* resolveEnvironmentConfigEffect(config, requested).pipe(
          Effect.either,
        );
        selectedEnvironment = environment._tag === 'Right' ? environment.right : null;
      }
    }

    const lines: string[] = ['Firestore Extension Status', ''];

    lines.push(`Config: ${status.hasConfig ? '✅ Loaded' : '❌ Missing (.pi/firestore.json)'}`);
    lines.push(`Service Account: ${status.hasServiceAccount ? '✅ Configured' : '❌ Missing'}`);
    lines.push(`Default Environment: ${status.defaultEnvironment ?? '(not set)'}`);
    lines.push(`Available Environments: ${status.environments.join(', ') || '(none)'}`);
    lines.push(`Selected Environment: ${selectedEnvironment?.name ?? '(none)'}`);
    lines.push(`Project ID: ${selectedEnvironment?.projectId ?? status.projectId ?? '(not set)'}`);
    lines.push(
      `Default Collection: ${selectedEnvironment?.defaultCollection ?? status.defaultCollection ?? '(not set)'}`,
    );
    lines.push('');
    lines.push(`Firestore Client: ${selectedDb ? '✅ Connected' : '❌ Not initialized'}`);
    if (connectionError) {
      lines.push(`Connection Error: ${connectionError}`);
    }

    if (selectedDb) {
      const collections = yield* Effect.tryPromise({
        try: () => listCollections(selectedDb),
        catch: (cause) => cause,
      }).pipe(Effect.either);
      lines.push('');
      if (collections._tag === 'Right') {
        lines.push(
          `Top-level collections (${collections.right.length}): ${collections.right.map((c) => c.id).join(', ') || '(none)'}`,
        );
      } else {
        lines.push('Could not list collections.');
      }
    }

    return lines;
  });
}
