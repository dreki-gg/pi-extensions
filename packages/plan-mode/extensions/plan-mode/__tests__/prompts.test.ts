import { describe, expect, test } from 'bun:test';
import { buildPlanModePrompt, buildExecutionPrompt } from '../prompts.js';
import { PLAN_TOOLS } from '../constants.js';
import type { PlanData, TaskRecord } from '../types.js';

const now = '2026-01-01T00:00:00Z';
function makeTask(overrides?: Partial<TaskRecord>): TaskRecord {
  return {
    _type: 'task',
    id: 't-001',
    description: 'Do work',
    status: 'pending',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('buildPlanModePrompt', () => {
  const prompt = buildPlanModePrompt();

  test('mentions technical-options skill for significant decisions', () => {
    expect(prompt).toContain('technical-options');
  });

  test('instructs delegation tasks to include a verification gate', () => {
    expect(prompt).toContain('verification gate');
    expect(prompt).toContain('STOP conditions');
  });

  test('mentions handoff instead of context and risks', () => {
    expect(prompt).toContain('handoff');
    expect(prompt).not.toContain('- risks:');
    expect(prompt).not.toContain('- context:');
  });

  test('tells planner to do proposal generation itself, not delegate', () => {
    // The planner should generate proposals as the main agent, only using
    // subagents for voting/evaluation — not delegating the entire workflow
    expect(prompt).toMatch(/you.*generat|generat.*yourself|do this yourself/i);
  });

  test('mentions subagent is available for voting only', () => {
    // Should clarify subagent is for evaluation, not for the whole workflow
    expect(prompt).toMatch(/subagent|voting|evaluat/i);
  });
});

describe('buildPlanModePrompt lightweight plan guidance', () => {
  const prompt = buildPlanModePrompt();

  test('mentions self-execution lightweight mode', () => {
    expect(prompt).toMatch(/lightweight|checklist/i);
  });

  test('mentions delegation plans with full details', () => {
    expect(prompt).toMatch(/delegation|different agent/i);
  });
});

describe('buildExecutionPrompt', () => {
  test('omits Details line when task has no details', () => {
    const plan: PlanData = { title: 'Test', planName: 'test', handoff: '# H', tasks: [makeTask()] };
    const prompt = buildExecutionPrompt(plan)!;
    expect(prompt).not.toContain('Details:');
    expect(prompt).toContain('t-001: Do work');
  });

  test('includes Details line when task has details', () => {
    const plan: PlanData = {
      title: 'Test',
      planName: 'test',
      handoff: '# H',
      tasks: [makeTask({ details: 'Full instructions here' })],
    };
    const prompt = buildExecutionPrompt(plan)!;
    expect(prompt).toContain('Details: Full instructions here');
  });

  test('includes a drift check when base_commit is present', () => {
    const plan: PlanData = {
      title: 'Test',
      planName: 'test',
      handoff: '# H',
      tasks: [makeTask()],
      base_commit: 'deadbeef',
    };
    const prompt = buildExecutionPrompt(plan)!;
    expect(prompt).toContain('Drift check');
    expect(prompt).toContain('deadbeef');
  });

  test('omits the drift check when base_commit is absent', () => {
    const plan: PlanData = { title: 'Test', planName: 'test', handoff: '# H', tasks: [makeTask()] };
    expect(buildExecutionPrompt(plan)!).not.toContain('Drift check');
  });

  test('returns undefined when no pending tasks', () => {
    const plan: PlanData = {
      title: 'Test',
      planName: 'test',
      handoff: '# H',
      tasks: [makeTask({ status: 'done' })],
    };
    expect(buildExecutionPrompt(plan)).toBeUndefined();
  });
});

describe('PLAN_TOOLS', () => {
  test('includes subagent for voting workflows', () => {
    expect(PLAN_TOOLS).toContain('subagent');
  });

  test('includes search_skills for skill discovery', () => {
    expect(PLAN_TOOLS).toContain('search_skills');
  });
});
