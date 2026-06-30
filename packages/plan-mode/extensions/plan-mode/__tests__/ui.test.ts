import { describe, expect, test } from 'bun:test';
import { updateUI } from '../ui.js';
import { PlanModeState } from '../state.js';
import type { PlanData, TaskRecord } from '../types.js';

function makePlan(): PlanData {
  const done: TaskRecord = {
    _type: 'task',
    id: 't-001',
    description: 'Done work',
    details: '',
    status: 'done',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const pending: TaskRecord = { ...done, id: 't-002', status: 'pending' };
  return { title: 'T', planName: 'test', handoff: '# H', tasks: [done, pending] };
}

function makeCtx() {
  const statusCalls: Array<[string, unknown]> = [];
  const widgetCalls: Array<[string, unknown]> = [];
  const ctx = {
    ui: {
      theme: { fg: (_role: string, text: string) => text },
      setStatus: (id: string, value: unknown) => statusCalls.push([id, value]),
      setWidget: (id: string, value: unknown) => widgetCalls.push([id, value]),
    },
  } as unknown as Parameters<typeof updateUI>[1];
  return { ctx, statusCalls, widgetCalls };
}

describe('updateUI', () => {
  test('never renders plan progress from memory — status is always cleared', () => {
    const cases: Array<Partial<PlanModeState>> = [
      { executing: true, plan: makePlan() },
      { executing: false, planEnabled: false, plan: makePlan() },
      { planEnabled: true },
      {},
    ];

    for (const overrides of cases) {
      const state = Object.assign(new PlanModeState(), overrides);
      const { ctx, statusCalls, widgetCalls } = makeCtx();

      updateUI(state, ctx);

      expect(statusCalls).toEqual([['plan-mode', undefined]]);
      expect(widgetCalls).toEqual([['plan-todos', undefined]]);
    }
  });
});
