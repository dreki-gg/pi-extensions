import { describe, expect, it } from 'bun:test';
import {
  validateCollectionPath,
  validateDocumentPath,
  parseWhereOp,
  VALID_OPS,
  type WhereClause,
  type OrderByClause,
} from '../extensions/firestore/client.js';

describe('validateCollectionPath', () => {
  it('accepts a top-level collection', () => {
    expect(() => validateCollectionPath('users')).not.toThrow();
  });

  it('accepts a nested subcollection path', () => {
    expect(() =>
      validateCollectionPath('users/abc123/orders'),
    ).not.toThrow();
  });

  it('accepts deeply nested subcollection', () => {
    expect(() =>
      validateCollectionPath('users/abc/orders/xyz/items'),
    ).not.toThrow();
  });

  it('rejects a document path (even segments)', () => {
    expect(() => validateCollectionPath('users/abc123')).toThrow(
      'collection path',
    );
  });

  it('rejects empty string', () => {
    expect(() => validateCollectionPath('')).toThrow();
  });

  it('rejects path with trailing slash', () => {
    expect(() => validateCollectionPath('users/')).toThrow();
  });
});

describe('validateDocumentPath', () => {
  it('accepts a document path', () => {
    expect(() => validateDocumentPath('users/abc123')).not.toThrow();
  });

  it('accepts a nested document path', () => {
    expect(() =>
      validateDocumentPath('users/abc/orders/xyz'),
    ).not.toThrow();
  });

  it('rejects a collection path (odd segments)', () => {
    expect(() => validateDocumentPath('users')).toThrow('document path');
  });

  it('rejects empty string', () => {
    expect(() => validateDocumentPath('')).toThrow();
  });
});

describe('parseWhereOp', () => {
  it('accepts all valid operators', () => {
    for (const op of VALID_OPS) {
      expect(parseWhereOp(op)).toBe(op);
    }
  });

  it('rejects invalid operator', () => {
    expect(() => parseWhereOp('LIKE')).toThrow('Invalid operator');
  });

  it('rejects empty string', () => {
    expect(() => parseWhereOp('')).toThrow('Invalid operator');
  });
});

describe('WhereClause type', () => {
  it('is well-typed', () => {
    const clause: WhereClause = {
      field: 'status',
      op: '==',
      value: 'active',
    };
    expect(clause.field).toBe('status');
    expect(clause.op).toBe('==');
    expect(clause.value).toBe('active');
  });
});

describe('OrderByClause type', () => {
  it('supports asc and desc', () => {
    const asc: OrderByClause = { field: 'createdAt', direction: 'asc' };
    const desc: OrderByClause = { field: 'createdAt', direction: 'desc' };
    expect(asc.direction).toBe('asc');
    expect(desc.direction).toBe('desc');
  });
});
