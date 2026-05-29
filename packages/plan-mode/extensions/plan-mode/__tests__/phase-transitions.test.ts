import { describe, expect, test } from 'bun:test';
import { PlanModeState } from '../state.js';
import type { PlanData, TaskRecord } from '../types.js';

function makePlan(overrides?: Partial<PlanData>): PlanData {
  const task: TaskRecord = {
    _type: 'task',
    id: 't-001',
    description: 'Do work',
    details: 'Details',
    status: 'pending',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  return {
    title: 'Test Plan',
    planName: 'test-plan',
    handoff: '# Handoff',
    tasks: [task],
    ...overrides,
  };
}

describe('PlanModeState', () => {
  describe('exitPreservingPlan', () => {
    test('clears mode flags but keeps plan data when a plan was submitted', () => {
      const state = new PlanModeState();
      state.planEnabled = true;
      state.planDir = '.plans/test-plan';
      state.plan = makePlan();

      state.exitPreservingPlan();

      expect(state.planEnabled).toBe(false);
      expect(state.executing).toBe(false);
      expect(state.plan).toBeDefined();
      expect(state.planDir).toBe('.plans/test-plan');
    });

    test('fully resets when no plan was submitted', () => {
      const state = new PlanModeState();
      state.planEnabled = true;
      state.planDir = undefined;
      state.plan = undefined;

      state.exitPreservingPlan();

      expect(state.planEnabled).toBe(false);
      expect(state.plan).toBeUndefined();
      expect(state.planDir).toBeUndefined();
    });
  });
});
