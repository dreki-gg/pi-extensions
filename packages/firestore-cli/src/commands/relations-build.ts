import type { Firestore } from 'firebase-admin/firestore';
import type { FirestoreProjectConfig } from '../config/types.js';
import { inferFieldRelationships, type RelationMap, type Relationship } from './relations-infer.js';
import { scanCodebase, type CodebaseRef } from './relations-scan.js';

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function mergeRelationships(relationships: Relationship[]): Relationship[] {
  const map = new Map<string, Relationship>();
  for (const rel of relationships) {
    const key = `${rel.from}→${rel.to}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...rel, evidence: [...rel.evidence] });
      continue;
    }
    for (const ev of rel.evidence) {
      if (!existing.evidence.includes(ev)) existing.evidence.push(ev);
    }
    if (CONFIDENCE_RANK[rel.confidence] > CONFIDENCE_RANK[existing.confidence]) {
      existing.confidence = rel.confidence;
    }
  }
  return [...map.values()];
}

function inferCodeRelationships(refs: CodebaseRef[]): Relationship[] {
  const fileCollections = new Map<string, Set<string>>();
  for (const ref of refs) {
    if (!fileCollections.has(ref.file)) fileCollections.set(ref.file, new Set());
    fileCollections.get(ref.file)!.add(ref.collection);
  }
  const relationships: Relationship[] = [];
  for (const [file, collections] of fileCollections) {
    const arr = [...collections];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        relationships.push({
          from: arr[i],
          to: arr[j],
          type: 'code_reference',
          confidence: 'medium',
          evidence: [`Referenced together in ${file}`],
        });
      }
    }
  }
  return relationships;
}

export async function buildRelationMap(
  db: Firestore,
  cwd: string,
  config: Pick<FirestoreProjectConfig, 'maxSampleSize' | 'scanPaths' | 'scanExclude'>,
  targetCollections?: string[],
): Promise<RelationMap> {
  const collectionRefs = await db.listCollections();
  const allCollectionIds = collectionRefs.map((ref) => ref.id);
  const collectionsToAnalyze = targetCollections ?? allCollectionIds;
  const codeRefs = await scanCodebase(cwd, config);
  const fieldRelationships: Relationship[] = [];
  const collectionNodes = [];

  for (const colId of collectionsToAnalyze) {
    const snapshot = await db.collection(colId).limit(config.maxSampleSize).get();
    const allFields = new Set<string>();
    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      for (const key of Object.keys(data)) allFields.add(key);
      fieldRelationships.push(...inferFieldRelationships(colId, data, allCollectionIds));
    }
    collectionNodes.push({
      id: colId,
      path: colId,
      documentCount: snapshot.size,
      sampleFields: [...allFields],
    });
  }

  return {
    collections: collectionNodes,
    relationships: mergeRelationships([
      ...inferCodeRelationships(codeRefs),
      ...fieldRelationships,
    ]),
  };
}
