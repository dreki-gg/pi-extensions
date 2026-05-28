import { describe, expect, it } from 'bun:test';
import {
  formatDocumentResult,
  formatQueryResult,
  formatCollectionList,
  formatCountResult,
  formatRelationMap,
  formatQuerySummary,
} from '../extensions/firestore/format.js';
import type { DocumentResult, QueryResult, CollectionInfo } from '../extensions/firestore/client.js';
import type { RelationMap } from '../extensions/firestore/relations.js';

const sampleDoc: DocumentResult = {
  id: 'abc123',
  path: 'users/abc123',
  data: { name: 'Alice', email: 'alice@example.com', age: 30 },
  createTime: '2024-01-01T00:00:00.000Z',
  updateTime: '2024-06-15T12:00:00.000Z',
};

describe('formatDocumentResult', () => {
  it('formats a document with all fields', () => {
    const result = formatDocumentResult(sampleDoc);
    expect(result).toContain('abc123');
    expect(result).toContain('users/abc123');
    expect(result).toContain('Alice');
    expect(result).toContain('alice@example.com');
    expect(result).toContain('2024-01-01');
  });

  it('truncates long data', () => {
    const longDoc: DocumentResult = {
      id: 'long',
      path: 'docs/long',
      data: { content: 'x'.repeat(1000) },
    };
    const result = formatDocumentResult(longDoc);
    expect(result).toContain('…');
    expect(result.length).toBeLessThan(1500);
  });
});

describe('formatQueryResult', () => {
  it('formats multiple documents', () => {
    const queryResult: QueryResult = {
      documents: [
        sampleDoc,
        { ...sampleDoc, id: 'def456', path: 'users/def456', data: { name: 'Bob' } },
      ],
      collection: 'users',
      totalReturned: 2,
      hasMore: false,
    };
    const result = formatQueryResult(queryResult);
    expect(result).toContain('Firestore Query Results');
    expect(result).toContain('users');
    expect(result).toContain('2 documents');
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
  });

  it('formats empty results', () => {
    const queryResult: QueryResult = {
      documents: [],
      collection: 'empty',
      totalReturned: 0,
      hasMore: false,
    };
    const result = formatQueryResult(queryResult);
    expect(result).toContain('No documents found');
  });

  it('indicates pagination when hasMore is true', () => {
    const queryResult: QueryResult = {
      documents: [sampleDoc],
      collection: 'users',
      totalReturned: 1,
      hasMore: true,
      lastDocId: 'abc123',
    };
    const result = formatQueryResult(queryResult);
    expect(result).toContain('more results');
  });
});

describe('formatCollectionList', () => {
  it('formats a list of collections', () => {
    const collections: CollectionInfo[] = [
      { id: 'users', path: 'users' },
      { id: 'orders', path: 'orders' },
    ];
    const result = formatCollectionList(collections);
    expect(result).toContain('users');
    expect(result).toContain('orders');
    expect(result).toContain('2 collections');
  });

  it('formats empty list', () => {
    const result = formatCollectionList([]);
    expect(result).toContain('No collections found');
  });
});

describe('formatCountResult', () => {
  it('formats count without filters', () => {
    const result = formatCountResult('users', 42);
    expect(result).toContain('users');
    expect(result).toContain('42');
  });

  it('formats count with filters', () => {
    const result = formatCountResult('users', 5, [
      { field: 'status', op: '==', value: 'active' },
    ]);
    expect(result).toContain('users');
    expect(result).toContain('5');
    expect(result).toContain('status');
    expect(result).toContain('active');
  });
});

describe('formatRelationMap', () => {
  it('formats a relation map', () => {
    const map: RelationMap = {
      collections: [
        { id: 'users', path: 'users', sampleFields: ['name', 'email'] },
        { id: 'orders', path: 'orders', sampleFields: ['userId', 'total'] },
      ],
      relationships: [
        {
          from: 'orders',
          to: 'users',
          type: 'reference_field',
          confidence: 'high',
          evidence: ['Field "userId" in orders → users collection'],
        },
      ],
    };
    const result = formatRelationMap(map);
    expect(result).toContain('users');
    expect(result).toContain('orders');
    expect(result).toContain('userId');
    expect(result).toContain('high');
  });

  it('formats empty map', () => {
    const map: RelationMap = { collections: [], relationships: [] };
    const result = formatRelationMap(map);
    expect(result).toContain('No collections');
  });
});

describe('formatQuerySummary', () => {
  it('returns structured summary', () => {
    const queryResult: QueryResult = {
      documents: [
        sampleDoc,
        { ...sampleDoc, id: 'def', path: 'users/def', data: { name: 'Bob', age: 25 } },
      ],
      collection: 'users',
      totalReturned: 2,
      hasMore: false,
    };
    const summary = formatQuerySummary(queryResult);
    expect(summary.totalReturned).toBe(2);
    expect(summary.collection).toBe('users');
    expect(summary.hasMore).toBe(false);
    expect(summary.fields).toContain('name');
  });
});
