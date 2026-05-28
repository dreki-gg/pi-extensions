import type { Firestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Glob } from 'bun';
import type { FirestoreProjectConfig } from './config.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CollectionNode {
  id: string;
  path: string;
  documentCount?: number;
  sampleFields: string[];
}

export interface Relationship {
  from: string;
  to: string;
  type: 'reference_field' | 'code_reference' | 'subcollection';
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

export interface RelationMap {
  collections: CollectionNode[];
  relationships: Relationship[];
}

export interface CodebaseRef {
  collection: string;
  file: string;
  line?: number;
}

// ─── Codebase Scan ───────────────────────────────────────────────────────────

/**
 * Regex patterns to detect Firestore collection/doc references in source code.
 */
const COLLECTION_PATTERNS = [
  // collection('name'), collection("name"), collection(`name`)
  /\.collection\(\s*['"`]([a-zA-Z_][\w-]*)['"`]\s*\)/g,
  // doc('collection/id'), doc("collection/id/sub/id")
  /\.doc\(\s*['"`]([a-zA-Z_][\w-]*(?:\/[^'"`]+)*)['"`]\s*\)/g,
];

/**
 * Extracts collection references from a source code string.
 */
export function extractCollectionRefs(
  code: string,
  filePath: string,
): CodebaseRef[] {
  const refs: CodebaseRef[] = [];

  for (const pattern of COLLECTION_PATTERNS) {
    // Reset lastIndex for global regex
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const value = match[1];
      // For doc() paths, extract all collection segments (odd positions)
      if (value.includes('/')) {
        const segments = value.split('/');
        for (let i = 0; i < segments.length; i += 2) {
          refs.push({ collection: segments[i], file: filePath });
        }
      } else {
        refs.push({ collection: value, file: filePath });
      }
    }
  }

  return refs;
}

/**
 * Scans the codebase for Firestore collection references.
 */
export async function scanCodebase(
  cwd: string,
  config: FirestoreProjectConfig,
): Promise<CodebaseRef[]> {
  const allRefs: CodebaseRef[] = [];
  const extensions = ['ts', 'tsx', 'js', 'jsx'];

  for (const scanPath of config.scanPaths) {
    const basePath = join(cwd, scanPath);

    for (const ext of extensions) {
      const glob = new Glob(`**/*.${ext}`);
      for await (const file of glob.scan({
        cwd: basePath,
        absolute: false,
      })) {
        // Check excludes
        const shouldExclude = config.scanExclude.some(
          (pattern) => file.includes(pattern) || file.startsWith(pattern),
        );
        if (shouldExclude) continue;

        try {
          const fullPath = join(basePath, file);
          const content = await readFile(fullPath, 'utf-8');
          const relativePath = join(scanPath, file);
          const refs = extractCollectionRefs(content, relativePath);
          allRefs.push(...refs);
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  return allRefs;
}

// ─── Field Analysis ──────────────────────────────────────────────────────────

/**
 * Pluralizes a singular word naively (for matching field names to collections).
 * Handles common cases: user→users, category→categories, index→indexes
 */
function pluralize(word: string): string {
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z')) {
    return `${word}es`;
  }
  return `${word}s`;
}

/**
 * Infers relationships from document fields by detecting reference-like patterns.
 */
export function inferFieldRelationships(
  sourceCollection: string,
  docData: Record<string, unknown>,
  knownCollections: string[],
): Relationship[] {
  const relationships: Relationship[] = [];

  for (const [field, value] of Object.entries(docData)) {
    // Pattern 1: field ends in Id, Ref, _id, _ref → extract base name
    const idMatch = field.match(/^(.+?)(?:Id|Ref|_id|_ref)$/);
    if (idMatch) {
      const baseName = idMatch[1].toLowerCase();
      const plural = pluralize(baseName);

      // Check if base name or its plural matches a known collection
      const targetCollection = knownCollections.find(
        (c) => c.toLowerCase() === baseName || c.toLowerCase() === plural,
      );

      if (targetCollection && targetCollection !== sourceCollection) {
        relationships.push({
          from: sourceCollection,
          to: targetCollection,
          type: 'reference_field',
          confidence: 'high',
          evidence: [
            `Field "${field}" in ${sourceCollection} → ${targetCollection} collection`,
          ],
        });
        continue;
      }
    }

    // Pattern 2: string value looks like a Firestore path (contains /)
    if (typeof value === 'string' && value.includes('/')) {
      const segments = value.split('/');
      if (segments.length >= 2 && segments.length % 2 === 0) {
        const pathCollection = segments[0];
        const targetCollection = knownCollections.find(
          (c) => c.toLowerCase() === pathCollection.toLowerCase(),
        );

        if (targetCollection && targetCollection !== sourceCollection) {
          relationships.push({
            from: sourceCollection,
            to: targetCollection,
            type: 'reference_field',
            confidence: 'medium',
            evidence: [
              `Field "${field}" contains path-like value referencing ${targetCollection}`,
            ],
          });
        }
      }
    }
  }

  return relationships;
}

// ─── Merge ───────────────────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Merges duplicate relationships, combining evidence and keeping highest confidence.
 */
export function mergeRelationships(
  relationships: Relationship[],
): Relationship[] {
  const map = new Map<string, Relationship>();

  for (const rel of relationships) {
    const key = `${rel.from}→${rel.to}`;
    const existing = map.get(key);

    if (existing) {
      // Merge evidence
      for (const ev of rel.evidence) {
        if (!existing.evidence.includes(ev)) {
          existing.evidence.push(ev);
        }
      }
      // Keep highest confidence
      if (CONFIDENCE_RANK[rel.confidence] > CONFIDENCE_RANK[existing.confidence]) {
        existing.confidence = rel.confidence;
      }
    } else {
      map.set(key, { ...rel, evidence: [...rel.evidence] });
    }
  }

  return [...map.values()];
}

// ─── Build Relation Map ──────────────────────────────────────────────────────

/**
 * Infer code-based relationships when two collections are referenced in the same file.
 */
function inferCodeRelationships(refs: CodebaseRef[]): Relationship[] {
  const fileCollections = new Map<string, Set<string>>();

  for (const ref of refs) {
    if (!fileCollections.has(ref.file)) {
      fileCollections.set(ref.file, new Set());
    }
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

/**
 * Builds the full relation map combining codebase scan and field analysis.
 */
export async function buildRelationMap(
  db: Firestore,
  cwd: string,
  config: FirestoreProjectConfig,
  targetCollections?: string[],
): Promise<RelationMap> {
  // 1. List collections
  const collectionRefs = await db.listCollections();
  const allCollectionIds = collectionRefs.map((ref) => ref.id);
  const collectionsToAnalyze = targetCollections ?? allCollectionIds;

  // 2. Scan codebase
  const codeRefs = await scanCodebase(cwd, config);
  const codeRelationships = inferCodeRelationships(codeRefs);

  // 3. Sample docs and analyze fields
  const fieldRelationships: Relationship[] = [];
  const collectionNodes: CollectionNode[] = [];

  for (const colId of collectionsToAnalyze) {
    const colRef = db.collection(colId);
    const snapshot = await colRef.limit(config.maxSampleSize).get();

    const allFields = new Set<string>();
    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        allFields.add(key);
      }

      const rels = inferFieldRelationships(colId, data, allCollectionIds);
      fieldRelationships.push(...rels);
    }

    collectionNodes.push({
      id: colId,
      path: colId,
      documentCount: snapshot.size,
      sampleFields: [...allFields],
    });
  }

  // 4. Merge all relationships
  const allRelationships = mergeRelationships([
    ...codeRelationships,
    ...fieldRelationships,
  ]);

  return {
    collections: collectionNodes,
    relationships: allRelationships,
  };
}
