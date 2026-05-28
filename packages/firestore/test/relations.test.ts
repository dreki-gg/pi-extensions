import { describe, expect, it } from 'bun:test';
import {
  extractCollectionRefs,
  inferFieldRelationships,
  mergeRelationships,
  type Relationship,
} from '../extensions/firestore/relations.js';

// ─── Codebase Scan ───────────────────────────────────────────────────────────

describe('extractCollectionRefs', () => {
  it('extracts collection("name") pattern', () => {
    const code = `const ref = db.collection("users");`;
    const refs = extractCollectionRefs(code, 'src/app.ts');
    expect(refs).toContainEqual(
      expect.objectContaining({ collection: 'users', file: 'src/app.ts' }),
    );
  });

  it("extracts collection('name') with single quotes", () => {
    const code = `const ref = db.collection('orders');`;
    const refs = extractCollectionRefs(code, 'src/app.ts');
    expect(refs).toContainEqual(
      expect.objectContaining({ collection: 'orders' }),
    );
  });

  it('extracts doc("collection/id") pattern', () => {
    const code = `const ref = db.doc("users/abc123");`;
    const refs = extractCollectionRefs(code, 'src/app.ts');
    expect(refs).toContainEqual(
      expect.objectContaining({ collection: 'users' }),
    );
  });

  it('extracts template literal collection refs', () => {
    const code = 'const ref = db.collection(`users`);';
    const refs = extractCollectionRefs(code, 'src/app.ts');
    expect(refs).toContainEqual(
      expect.objectContaining({ collection: 'users' }),
    );
  });

  it('extracts multiple collections from same file', () => {
    const code = `
      const users = db.collection('users');
      const orders = db.collection('orders');
    `;
    const refs = extractCollectionRefs(code, 'src/app.ts');
    const collections = refs.map((r) => r.collection);
    expect(collections).toContain('users');
    expect(collections).toContain('orders');
  });

  it('ignores non-collection patterns', () => {
    const code = `const name = "users"; console.log(name);`;
    const refs = extractCollectionRefs(code, 'src/app.ts');
    expect(refs).toHaveLength(0);
  });

  it('extracts subcollection path from doc()', () => {
    const code = `const ref = db.doc("users/abc/orders/xyz");`;
    const refs = extractCollectionRefs(code, 'src/app.ts');
    const collections = refs.map((r) => r.collection);
    expect(collections).toContain('users');
    expect(collections).toContain('orders');
  });
});

// ─── Field Analysis ──────────────────────────────────────────────────────────

describe('inferFieldRelationships', () => {
  it('detects userId → users as high confidence', () => {
    const rels = inferFieldRelationships(
      'orders',
      { userId: 'abc123', total: 100 },
      ['users', 'orders', 'products'],
    );
    expect(rels).toContainEqual(
      expect.objectContaining({
        from: 'orders',
        to: 'users',
        confidence: 'high',
      }),
    );
  });

  it('detects productRef → products as high confidence', () => {
    const rels = inferFieldRelationships(
      'orders',
      { productRef: 'xyz', total: 100 },
      ['users', 'orders', 'products'],
    );
    expect(rels).toContainEqual(
      expect.objectContaining({
        from: 'orders',
        to: 'products',
        confidence: 'high',
      }),
    );
  });

  it('detects generic _id suffix as medium confidence', () => {
    const rels = inferFieldRelationships(
      'orders',
      { customer_id: 'abc123' },
      ['users', 'customers', 'orders'],
    );
    expect(rels).toContainEqual(
      expect.objectContaining({
        from: 'orders',
        to: 'customers',
        confidence: 'high',
      }),
    );
  });

  it('detects path-like values as medium confidence', () => {
    const rels = inferFieldRelationships(
      'orders',
      { authorPath: 'users/abc123' },
      ['users', 'orders'],
    );
    expect(rels).toContainEqual(
      expect.objectContaining({
        from: 'orders',
        to: 'users',
        confidence: 'medium',
      }),
    );
  });

  it('returns empty for non-reference fields', () => {
    const rels = inferFieldRelationships(
      'users',
      { name: 'Alice', age: 30 },
      ['users', 'orders'],
    );
    expect(rels).toHaveLength(0);
  });
});

// ─── Merge ───────────────────────────────────────────────────────────────────

describe('mergeRelationships', () => {
  it('merges duplicate relationships and combines evidence', () => {
    const rels: Relationship[] = [
      {
        from: 'orders',
        to: 'users',
        type: 'reference_field',
        confidence: 'high',
        evidence: ['Field "userId"'],
      },
      {
        from: 'orders',
        to: 'users',
        type: 'code_reference',
        confidence: 'medium',
        evidence: ['src/orders.ts:5'],
      },
    ];
    const merged = mergeRelationships(rels);
    expect(merged).toHaveLength(1);
    expect(merged[0].evidence).toHaveLength(2);
    expect(merged[0].confidence).toBe('high'); // highest wins
  });

  it('keeps distinct relationships separate', () => {
    const rels: Relationship[] = [
      {
        from: 'orders',
        to: 'users',
        type: 'reference_field',
        confidence: 'high',
        evidence: ['Field "userId"'],
      },
      {
        from: 'orders',
        to: 'products',
        type: 'reference_field',
        confidence: 'high',
        evidence: ['Field "productId"'],
      },
    ];
    const merged = mergeRelationships(rels);
    expect(merged).toHaveLength(2);
  });
});
