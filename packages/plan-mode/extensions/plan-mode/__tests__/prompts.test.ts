import { describe, expect, test } from 'bun:test';
import { buildPlanModePrompt } from '../prompts.js';
import { PLAN_TOOLS } from '../constants.js';

describe('buildPlanModePrompt', () => {
  const prompt = buildPlanModePrompt();

  test('mentions technical-options skill for significant decisions', () => {
    expect(prompt).toContain('technical-options');
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

describe('PLAN_TOOLS', () => {
  test('includes subagent for voting workflows', () => {
    expect(PLAN_TOOLS).toContain('subagent');
  });

  test('includes search_skills for skill discovery', () => {
    expect(PLAN_TOOLS).toContain('search_skills');
  });
});
