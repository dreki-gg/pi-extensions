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

function pluralize(word: string): string {
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z')) return `${word}es`;
  return `${word}s`;
}

export function inferFieldRelationships(
  sourceCollection: string,
  docData: Record<string, unknown>,
  knownCollections: string[],
): Relationship[] {
  const relationships: Relationship[] = [];
  for (const [field, value] of Object.entries(docData)) {
    const idMatch = field.match(/^(.+?)(?:Id|Ref|_id|_ref)$/);
    if (idMatch) {
      const baseName = idMatch[1].toLowerCase();
      const plural = pluralize(baseName);
      const target = knownCollections.find(
        (c) => c.toLowerCase() === baseName || c.toLowerCase() === plural,
      );
      if (target && target !== sourceCollection) {
        relationships.push({
          from: sourceCollection,
          to: target,
          type: 'reference_field',
          confidence: 'high',
          evidence: [`Field "${field}" in ${sourceCollection} → ${target} collection`],
        });
        continue;
      }
    }
    if (typeof value === 'string' && value.includes('/')) {
      const segments = value.split('/');
      if (segments.length >= 2 && segments.length % 2 === 0) {
        const target = knownCollections.find(
          (c) => c.toLowerCase() === segments[0].toLowerCase(),
        );
        if (target && target !== sourceCollection) {
          relationships.push({
            from: sourceCollection,
            to: target,
            type: 'reference_field',
            confidence: 'medium',
            evidence: [`Field "${field}" contains path-like value referencing ${target}`],
          });
        }
      }
    }
  }
  return relationships;
}
