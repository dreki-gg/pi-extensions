import type { Firestore } from 'firebase-admin/firestore';
import { validateCollectionPath, validateDocumentPath } from './paths.js';
import { parseWhereOp, type WhereClause } from './where.js';
import type {
  DocumentWithSubcollections,
  QueryParams,
  QueryResult,
  DocumentResult,
} from './ops-list.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function queryDocuments(db: Firestore, params: QueryParams): Promise<QueryResult> {
  validateCollectionPath(params.collection);
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  let query: FirebaseFirestore.Query = db.collection(params.collection);

  if (params.where) {
    for (const clause of params.where) {
      query = query.where(clause.field, parseWhereOp(clause.op), clause.value);
    }
  }
  if (params.orderBy) {
    query = query.orderBy(params.orderBy.field, params.orderBy.direction);
  }
  if (params.startAfter) {
    const cursorDoc = await db.collection(params.collection).doc(params.startAfter).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

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

export async function getDocument(
  db: Firestore,
  path: string,
): Promise<DocumentWithSubcollections> {
  validateDocumentPath(path);
  const docRef = db.doc(path);
  const [snapshot, subcollectionRefs] = await Promise.all([docRef.get(), docRef.listCollections()]);
  if (!snapshot.exists) throw new Error(`Document not found: ${path}`);
  return {
    id: snapshot.id,
    path: snapshot.ref.path,
    data: snapshot.data() as Record<string, unknown>,
    createTime: snapshot.createTime?.toDate().toISOString(),
    updateTime: snapshot.updateTime?.toDate().toISOString(),
    subcollections: subcollectionRefs.map((ref) => ({ id: ref.id, path: ref.path })),
  };
}

export async function countDocuments(
  db: Firestore,
  collection: string,
  where?: WhereClause[],
): Promise<number> {
  validateCollectionPath(collection);
  let query: FirebaseFirestore.Query = db.collection(collection);
  if (where) {
    for (const clause of where) {
      query = query.where(clause.field, parseWhereOp(clause.op), clause.value);
    }
  }
  const snapshot = await query.count().get();
  return snapshot.data().count;
}
