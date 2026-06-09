import { describe, expect, test } from 'bun:test';
import {
  PLAN_TOKEN_PREFIX,
  buildPlanToken,
  parsePlanSlug,
  findActivePlanToken,
  extractPlanReferences,
  firstPlanReference,
} from '../references/tokens.js';

describe('buildPlanToken / parsePlanSlug', () => {
  test('round-trips a slug', () => {
    const token = buildPlanToken('add-auth-middleware');
    expect(token).toBe(`${PLAN_TOKEN_PREFIX}add-auth-middleware`);
    expect(parsePlanSlug(token)).toBe('add-auth-middleware');
  });

  test('parsePlanSlug returns undefined for non-plan tokens', () => {
    expect(parsePlanSlug('@chat:abc')).toBeUndefined();
    expect(parsePlanSlug('@plan:')).toBeUndefined();
  });
});

describe('findActivePlanToken', () => {
  test('detects a token being typed at the cursor', () => {
    const active = findActivePlanToken('start working on @plan:add-au');
    expect(active?.query).toBe('add-au');
    expect(active?.token).toBe('@plan:add-au');
  });

  test('detects an empty query right after the prefix', () => {
    const active = findActivePlanToken('do @plan:');
    expect(active?.query).toBe('');
  });

  test('returns undefined when there is no token at the cursor', () => {
    expect(findActivePlanToken('just some text')).toBeUndefined();
    expect(findActivePlanToken('email me@plan-b.com')).toBeUndefined();
  });

  test('does not match when the token is not adjacent to the cursor', () => {
    expect(findActivePlanToken('@plan:foo and more text')).toBeUndefined();
  });
});

describe('extractPlanReferences / firstPlanReference', () => {
  test('extracts all tokens in order', () => {
    const tokens = extractPlanReferences('work on @plan:alpha then @plan:beta');
    expect(tokens).toEqual(['@plan:alpha', '@plan:beta']);
  });

  test('first-wins helper returns only the first slug', () => {
    expect(firstPlanReference('work on @plan:alpha then @plan:beta')).toBe('alpha');
  });

  test('firstPlanReference returns undefined when no token present', () => {
    expect(firstPlanReference('nothing here')).toBeUndefined();
  });

  test('does not treat email-like text as a token', () => {
    expect(extractPlanReferences('reach me@plan-x.dev')).toEqual([]);
  });
});
