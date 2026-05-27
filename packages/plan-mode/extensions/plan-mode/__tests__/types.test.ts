import { describe, expect, test } from 'bun:test';
import { isTaskMeta, isTaskRecord } from '../types.js';

const now = '2026-05-27T12:00:00.000Z';

describe('task record type guards', () => {
  test('accepts valid task records', () => {
    expect(
      isTaskRecord({
        _type: 'task',
        id: 't-001',
        description: 'Do work',
        details: 'Full instructions',
        status: 'pending',
        depends_on: ['t-000'],
        notes: 'note',
        created_at: now,
        updated_at: now,
      }),
    ).toBe(true);
  });

  test('rejects malformed task records', () => {
    expect(isTaskRecord({ _type: 'task', id: 't-001', status: 'pending' })).toBe(false);
    expect(
      isTaskRecord({
        _type: 'task',
        id: 't-001',
        description: 'Do work',
        details: 'Full instructions',
        status: 'unknown',
        created_at: now,
        updated_at: now,
      }),
    ).toBe(false);
  });
});

describe('task meta type guard', () => {
  test('accepts valid meta records', () => {
    expect(
      isTaskMeta({
        _type: 'meta',
        title: 'Refactor',
        plan_name: 'refactor',
        created_at: now,
      }),
    ).toBe(true);
  });

  test('rejects malformed meta records', () => {
    expect(isTaskMeta({ _type: 'meta', title: 'Refactor' })).toBe(false);
    expect(isTaskMeta({ _type: 'task', title: 'Refactor', plan_name: 'refactor', created_at: now })).toBe(false);
  });
});
