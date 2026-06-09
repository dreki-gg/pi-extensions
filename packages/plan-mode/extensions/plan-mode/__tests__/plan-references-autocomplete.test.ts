import { describe, expect, test } from 'bun:test';
import { filterPlanReferences, formatPlanSuggestion } from '../references/autocomplete.js';
import type { PlanListItem } from '../commands/list-plans.js';

function item(overrides: Partial<PlanListItem> & { name: string }): PlanListItem {
  return {
    title: `Title ${overrides.name}`,
    status: 'in-progress',
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
    totalTasks: 3,
    doneTasks: 1,
    pendingTasks: 2,
    ...overrides,
  };
}

const items: PlanListItem[] = [
  item({ name: 'done-plan', status: 'done' }),
  item({ name: 'active-one', status: 'in-progress' }),
  item({ name: 'abandoned-plan', status: 'abandoned' }),
  item({ name: 'active-two', status: 'in-progress' }),
];

describe('filterPlanReferences', () => {
  test('empty query lists all plans, in-progress first', () => {
    const result = filterPlanReferences(items, '');
    expect(result.map((p) => p.name).slice(0, 2).sort()).toEqual(['active-one', 'active-two']);
    expect(result).toHaveLength(4);
  });

  test('name-prefix matches win', () => {
    const result = filterPlanReferences(items, 'active-t');
    expect(result[0].name).toBe('active-two');
  });

  test('fuzzy fallback finds non-prefix matches', () => {
    const result = filterPlanReferences(items, 'abandon');
    expect(result.some((p) => p.name === 'abandoned-plan')).toBe(true);
  });

  test('returns empty array for no match', () => {
    expect(filterPlanReferences(items, 'zzz-nope-nope')).toHaveLength(0);
  });
});

describe('formatPlanSuggestion', () => {
  test('builds a @plan: value with status + progress description', () => {
    const suggestion = formatPlanSuggestion(item({ name: 'active-one', status: 'in-progress' }));
    expect(suggestion.value).toBe('@plan:active-one');
    expect(suggestion.label).toContain('Title active-one');
    expect(suggestion.description).toContain('active-one');
    expect(suggestion.description).toContain('1/3');
  });
});
