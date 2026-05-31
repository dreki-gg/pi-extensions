import { describe, expect, test } from 'bun:test';
import {
  activeTasksResolved,
  deferredTasks,
  isPlanFinalizable,
  reactivateForExecution,
} from '../task-status.js';
import type { TaskRecord, TaskStatus } from '../types.js';

const now = '2026-05-27T12:00:00.000Z';
let counter = 0;
const make = (status: TaskStatus, origin?: 'plan' | 'discovered'): TaskRecord => ({
  _type: 'task',
  id: `t-${String(++counter).padStart(3, '0')}`,
  description: 'task',
  status,
  origin,
  created_at: now,
  updated_at: now,
});

describe('deferredTasks', () => {
  test('returns only deferred tasks', () => {
    const tasks = [make('done'), make('deferred', 'discovered'), make('pending')];
    expect(deferredTasks(tasks).map((t) => t.status)).toEqual(['deferred']);
  });
});

describe('activeTasksResolved', () => {
  test('true when only done/skipped/deferred remain', () => {
    expect(
      activeTasksResolved([make('done'), make('skipped'), make('deferred', 'discovered')]),
    ).toBe(true);
  });

  test('false when a task is still pending', () => {
    expect(activeTasksResolved([make('done'), make('pending')])).toBe(false);
  });

  test('false when a task is still blocked', () => {
    expect(activeTasksResolved([make('done'), make('blocked')])).toBe(false);
  });
});

describe('isPlanFinalizable', () => {
  test('true when all work is done/skipped and nothing is deferred', () => {
    expect(isPlanFinalizable([make('done'), make('skipped')])).toBe(true);
  });

  test('false when a deferred follow-up awaits the user', () => {
    expect(isPlanFinalizable([make('done'), make('deferred', 'discovered')])).toBe(false);
  });

  test('false when active work remains', () => {
    expect(isPlanFinalizable([make('pending')])).toBe(false);
  });
});

describe('reactivateForExecution', () => {
  test('flips blocked and deferred tasks to pending and stamps updated_at', () => {
    const tasks = [make('done'), make('blocked'), make('deferred', 'discovered')];
    const ts = '2026-06-01T00:00:00.000Z';
    const changed = reactivateForExecution(tasks, ts);
    expect(changed).toBe(true);
    expect(tasks.map((t) => t.status)).toEqual(['done', 'pending', 'pending']);
    expect(tasks[1].updated_at).toBe(ts);
    expect(tasks[2].updated_at).toBe(ts);
  });

  test('returns false and leaves tasks untouched when nothing to reactivate', () => {
    const tasks = [make('done'), make('pending')];
    expect(reactivateForExecution(tasks, '2026-06-01T00:00:00.000Z')).toBe(false);
  });
});
