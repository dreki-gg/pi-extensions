import { describe, expect, test } from 'bun:test';
import { nextTaskId, toKebabCase } from '../ids.js';

describe('nextTaskId', () => {
  test('increments the max numeric suffix', () => {
    expect(nextTaskId(['t-001', 't-002', 't-003'])).toBe('t-004');
  });

  test('uses the max, not the count', () => {
    expect(nextTaskId(['t-003', 't-001', 't-010'])).toBe('t-011');
  });

  test('empty list starts at t-001', () => {
    expect(nextTaskId([])).toBe('t-001');
  });

  test('non-matching ids fall back to count+1', () => {
    expect(nextTaskId(['setup', 'cleanup'])).toBe('t-003');
  });
});

describe('toKebabCase', () => {
  test('lowercases and hyphenates', () => {
    expect(toKebabCase('Add Auth Middleware')).toBe('add-auth-middleware');
  });

  test('strips leading/trailing separators', () => {
    expect(toKebabCase('  Hello, World!  ')).toBe('hello-world');
  });

  test('caps length at 60 chars', () => {
    expect(toKebabCase('a'.repeat(100)).length).toBe(60);
  });
});
