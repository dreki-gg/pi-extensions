import type { Firestore } from 'firebase-admin/firestore';
import { validateDocumentPath } from './paths.js';
import type { OrderByClause, WhereClause } from './where.js';

export interface CollectionInfo {
  id: string;
  path: string;
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

export interface QueryParams {
  collection: string;
  where?: WhereClause[];
  orderBy?: OrderByClause;
  limit?: number;
  startAfter?: string;
}

export interface QueryResult {
  documents: DocumentResult[];
  collection: string;
  totalReturned: number;
  hasMore: boolean;
  lastDocId?: string;
}

export async function listCollections(
  db: Firestore,
  docPath?: string,
): Promise<CollectionInfo[]> {
  if (docPath) validateDocumentPath(docPath);
  const refs = docPath ? await db.doc(docPath).listCollections() : await db.listCollections();
  return refs.map((ref) => ({ id: ref.id, path: ref.path }));
}
