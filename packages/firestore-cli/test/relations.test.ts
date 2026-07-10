import { describe, expect, it } from 'bun:test';
import { extractCollectionRefs } from '../src/commands/relations-scan.js';
import { inferFieldRelationships } from '../src/commands/relations-infer.js';

describe('extractCollectionRefs', () => {
  it('extracts collection() and path-style doc() refs', () => {
    const code = `
      db.collection('users');
      db.doc('orders/abc');
    `;
    const refs = extractCollectionRefs(code, 'src/app.ts');
    expect(refs.map((r) => r.collection).sort()).toEqual(['orders', 'users']);
  });
});

describe('inferFieldRelationships', () => {
  it('detects userId → users', () => {
    const rels = inferFieldRelationships('orders', { userId: 'abc' }, ['users', 'orders']);
    expect(rels).toHaveLength(1);
    expect(rels[0].to).toBe('users');
    expect(rels[0].confidence).toBe('high');
  });
});
