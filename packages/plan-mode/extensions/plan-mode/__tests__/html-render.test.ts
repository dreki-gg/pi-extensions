import { describe, expect, test } from 'bun:test';
import { renderPlanHtml } from '../html/render.js';
import type { PlanData } from '../types.js';

const plan: PlanData = {
  title: 'Refactor Auth',
  planName: 'refactor-auth',
  handoff: '# Handoff\nShip carefully.',
  tasks: [
    {
      _type: 'task',
      id: 't-001',
      description: 'Add auth middleware',
      details: 'Implement the middleware.',
      status: 'pending',
      created_at: '2026-05-27T12:00:00.000Z',
      updated_at: '2026-05-27T12:00:00.000Z',
    },
  ],
};

describe('renderPlanHtml', () => {
  test('renders title, task count, handoff, and tasks', () => {
    const html = renderPlanHtml(plan);

    expect(html).toContain('Refactor Auth');
    expect(html).toContain('1 task');
    expect(html).toContain('Ship carefully.');
    expect(html).toContain('t-001');
    expect(html).toContain('Add auth middleware');
  });

  test('omits prototypes section when no prototype is provided', () => {
    expect(renderPlanHtml(plan)).not.toContain('Prototype');
  });

  test('renders optional prototype pug markup', () => {
    const html = renderPlanHtml(plan, '.mockup Prototype card');

    expect(html).toContain('Prototype');
    expect(html).toContain('Prototype card');
  });
});
