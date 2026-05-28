import type { Firestore } from 'firebase-admin/firestore';

// ─── Types ───────────────────────────────────────────────────────────────────

export const VALID_OPS = [
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'not-in',
  'array-contains',
  'array-contains-any',
] as const;

export type FirestoreOp = (typeof VALID_OPS)[number];

export interface WhereClause {
  field: string;
  op: FirestoreOp;
  value: unknown;
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryParams {
  collection: string;
  where?: WhereClause[];
  orderBy?: OrderByClause;
  limit?: number;
  startAfter?: string;
}

export interface DocumentResult {
  id: string;
  path: string;
  data: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}

export interface DocumentWithSubcollections extends DocumentResult {
  subcollections: CollectionInfo[];
}

export interface QueryResult {
  documents: DocumentResult[];
  collection: string;
  totalReturned: number;
  hasMore: boolean;
  lastDocId?: string;
}

export interface CollectionInfo {
  id: string;
  path: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates that a path represents a collection (odd number of segments).
 */
export function validateCollectionPath(path: string): void {
  if (path.endsWith('/')) {
    throw new Error(`Path cannot end with a trailing slash: "${path}"`);
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Path cannot be empty');
  }
  if (segments.length % 2 === 0) {
    throw new Error(
      `"${path}" is a document path (even segments). Expected a collection path (odd segments).`,
    );
  }
}

/**
 * Validates that a path represents a document (even number of segments).
 */
export function validateDocumentPath(path: string): void {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Path cannot be empty');
  }
  if (segments.length % 2 !== 0) {
    throw new Error(
      `"${path}" is a collection path (odd segments). Expected a document path (even segments).`,
    );
  }
}

/**
 * Validates and returns a where operator.
 */
export function parseWhereOp(op: string): FirestoreOp {
  if (!VALID_OPS.includes(op as FirestoreOp)) {
    throw new Error(
      `Invalid operator "${op}". Valid operators: ${VALID_OPS.join(', ')}`,
    );
  }
  return op as FirestoreOp;
}

// ─── Operations ──────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Lists collections. If docPath is provided, lists subcollections of that doc.
 * Otherwise lists top-level collections.
 */
export async function listCollections(
  db: Firestore,
  docPath?: string,
): Promise<CollectionInfo[]> {
  let refs: FirebaseFirestore.CollectionReference[];

  if (docPath) {
    validateDocumentPath(docPath);
    const docRef = db.doc(docPath);
    refs = await docRef.listCollections();
  } else {
    refs = await db.listCollections();
  }

  return refs.map((ref) => ({
    id: ref.id,
    path: ref.path,
  }));
}

/**
 * Queries documents from a collection with optional filters, ordering, and pagination.
 */
export async function queryDocuments(
  db: Firestore,
  params: QueryParams,
): Promise<QueryResult> {
  validateCollectionPath(params.collection);

  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  let query: FirebaseFirestore.Query = db.collection(params.collection);

  // Apply where clauses
  if (params.where) {
    for (const clause of params.where) {
      const op = parseWhereOp(clause.op);
      query = query.where(clause.field, op, clause.value);
    }
  }

  // Apply ordering
  if (params.orderBy) {
    query = query.orderBy(params.orderBy.field, params.orderBy.direction);
  }

  // Apply pagination cursor
  if (params.startAfter) {
    const cursorDoc = await db
      .collection(params.collection)
      .doc(params.startAfter)
      .get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  // Fetch one extra to detect if there are more
  const snapshot = await query.limit(limit + 1).get();
  const hasMore = snapshot.docs.length > limit;
  const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

  const documents: DocumentResult[] = docs.map((doc) => ({
    id: doc.id,
    path: doc.ref.path,
    data: doc.data() as Record<string, unknown>,
    createTime: doc.createTime?.toDate().toISOString(),
    updateTime: doc.updateTime?.toDate().toISOString(),
  }));

  return {
    documents,
    collection: params.collection,
    totalReturned: documents.length,
    hasMore,
    lastDocId: documents.at(-1)?.id,
  };
}

/**
 * Gets a single document by full path, including its subcollections.
 */
export async function getDocument(
  db: Firestore,
  path: string,
): Promise<DocumentWithSubcollections> {
  validateDocumentPath(path);

  const docRef = db.doc(path);
  const [snapshot, subcollectionRefs] = await Promise.all([
    docRef.get(),
    docRef.listCollections(),
  ]);

  if (!snapshot.exists) {
    throw new Error(`Document not found: ${path}`);
  }

  return {
    id: snapshot.id,
    path: snapshot.ref.path,
    data: snapshot.data() as Record<string, unknown>,
    createTime: snapshot.createTime?.toDate().toISOString(),
    updateTime: snapshot.updateTime?.toDate().toISOString(),
    subcollections: subcollectionRefs.map((ref) => ({
      id: ref.id,
      path: ref.path,
    })),
  };
}

/**
 * Counts documents in a collection with optional filters.
 */
export async function countDocuments(
  db: Firestore,
  collection: string,
  where?: WhereClause[],
): Promise<number> {
  validateCollectionPath(collection);

  let query: FirebaseFirestore.Query = db.collection(collection);

  if (where) {
    for (const clause of where) {
      const op = parseWhereOp(clause.op);
      query = query.where(clause.field, op, clause.value);
    }
  }

  const snapshot = await query.count().get();
  return snapshot.data().count;
}
