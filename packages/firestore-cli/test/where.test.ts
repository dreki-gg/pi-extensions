import { describe, expect, it } from 'bun:test';
import {
  coerceWhereValue,
  parseWhereFlag,
  parseWhereFlags,
  parseOrderByFlag,
  parseWhereOp,
} from '../src/commands/where.js';

describe('coerceWhereValue', () => {
  it('coerces booleans', () => {
    expect(coerceWhereValue('true')).toBe(true);
    expect(coerceWhereValue('false')).toBe(false);
  });

  it('coerces numbers', () => {
    expect(coerceWhereValue('42')).toBe(42);
    expect(coerceWhereValue('3.14')).toBe(3.14);
    expect(coerceWhereValue('-7')).toBe(-7);
  });

  it('coerces null and JSON arrays', () => {
    expect(coerceWhereValue('null')).toBe(null);
    expect(coerceWhereValue('["a","b"]')).toEqual(['a', 'b']);
  });

  it('keeps plain strings', () => {
    expect(coerceWhereValue('active')).toBe('active');
    expect(coerceWhereValue('true-ish')).toBe('true-ish');
  });
});

describe('parseWhereFlag', () => {
  it('parses field,op,value with coercion', () => {
    expect(parseWhereFlag('status,==,active')).toEqual({
      field: 'status',
      op: '==',
      value: 'active',
    });
    expect(parseWhereFlag('count,>,5')).toEqual({ field: 'count', op: '>', value: 5 });
    expect(parseWhereFlag('active,==,true')).toEqual({
      field: 'active',
      op: '==',
      value: true,
    });
  });

  it('allows commas inside the value', () => {
    expect(parseWhereFlag('tags,array-contains-any,["a","b"]')).toEqual({
      field: 'tags',
      op: 'array-contains-any',
      value: ['a', 'b'],
    });
  });

  it('rejects malformed clauses', () => {
    expect(() => parseWhereFlag('status')).toThrow('Expected field,op,value');
    expect(() => parseWhereFlag('status,LIKE,x')).toThrow('Invalid operator');
  });

  it('parses repeatable flags', () => {
    const clauses = parseWhereFlags(['a,==,1', 'b,!=,false']);
    expect(clauses).toEqual([
      { field: 'a', op: '==', value: 1 },
      { field: 'b', op: '!=', value: false },
    ]);
  });
});

describe('parseOrderByFlag', () => {
  it('defaults to asc', () => {
    expect(parseOrderByFlag('createdAt')).toEqual({ field: 'createdAt', direction: 'asc' });
  });

  it('accepts desc', () => {
    expect(parseOrderByFlag('createdAt,desc')).toEqual({
      field: 'createdAt',
      direction: 'desc',
    });
  });
});

describe('parseWhereOp', () => {
  it('accepts valid ops', () => {
    expect(parseWhereOp('==')).toBe('==');
    expect(parseWhereOp('array-contains')).toBe('array-contains');
  });
});
