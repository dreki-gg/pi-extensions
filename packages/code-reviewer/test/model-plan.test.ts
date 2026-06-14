import { describe, expect, test } from 'bun:test';

import { resolveModelSpec } from '../extensions/code-reviewer/effects/model';
import { resolveModelPlan } from '../extensions/code-reviewer/model-plan';
import type { ReviewPipelineConfig } from '../extensions/code-reviewer/types';

type FakeModel = { id: string; name: string; provider: string };

const MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai' },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'google' },
] satisfies FakeModel[];

// resolveModelSpec / resolveModelPlan only touch id/name/provider, so a
// structural stub registry is sufficient (cast through unknown for the Model type).
const registry = { getAll: () => MODELS as never };
const sessionModel = { id: 'session', name: 'Session', provider: 'local' } as never;

function config(overrides: Partial<ReviewPipelineConfig>): ReviewPipelineConfig {
  return {
    passes: 4,
    validate: true,
    minVotes: 2,
    concurrency: 4,
    temperature: 0.4,
    maxFindings: 50,
    recordRejections: true,
    ...overrides,
  };
}

describe('resolveModelSpec', () => {
  test('matches by provider/id, bare id, and display name', () => {
    expect(resolveModelSpec(registry, 'openai/gpt-5.5')?.id).toBe('gpt-5.5');
    expect(resolveModelSpec(registry, 'claude-opus-4-6')?.provider).toBe('anthropic');
    expect(resolveModelSpec(registry, 'Gemini 3 Pro')?.id).toBe('gemini-3-pro');
  });

  test('returns undefined for unknown or empty specs', () => {
    expect(resolveModelSpec(registry, 'openai/does-not-exist')).toBeUndefined();
    expect(resolveModelSpec(registry, '   ')).toBeUndefined();
  });
});

describe('resolveModelPlan', () => {
  test('no overrides → every step on the session model, no resolved specs', () => {
    const { plan, resolution, warnings } = resolveModelPlan(config({}), sessionModel, registry);
    expect(plan.passes.map((step) => step.key)).toEqual([
      'default',
      'default',
      'default',
      'default',
    ]);
    expect(plan.validator.key).toBe('default');
    expect(resolution.byKey.size).toBe(0);
    expect(warnings).toHaveLength(0);
  });

  test('passModels rotate round-robin across passes; validateModel routes the validator', () => {
    const { plan, resolution } = resolveModelPlan(
      config({
        passModels: ['openai/gpt-5.5', 'anthropic/claude-opus-4-6'],
        validateModel: 'google/gemini-3-pro',
      }),
      sessionModel,
      registry,
    );
    expect(plan.passes.map((step) => step.key)).toEqual([
      'openai/gpt-5.5',
      'anthropic/claude-opus-4-6',
      'openai/gpt-5.5',
      'anthropic/claude-opus-4-6',
    ]);
    expect(plan.validator.key).toBe('google/gemini-3-pro');
    // each distinct spec resolved exactly once into the map
    expect([...resolution.byKey.keys()].sort()).toEqual([
      'anthropic/claude-opus-4-6',
      'google/gemini-3-pro',
      'openai/gpt-5.5',
    ]);
  });

  test('passModel applies to all passes when passModels is absent', () => {
    const { plan } = resolveModelPlan(
      config({ passModel: 'openai/gpt-5.5' }),
      sessionModel,
      registry,
    );
    expect(plan.passes.map((step) => step.key)).toEqual(Array(4).fill('openai/gpt-5.5'));
  });

  test('a reasoning-bearing object spec carries reasoning + a labelled assignment', () => {
    const { plan } = resolveModelPlan(
      config({
        passModels: [{ model: 'anthropic/claude-opus-4-6', reasoning: 'low' }],
        validateModel: { model: 'anthropic/claude-opus-4-6', reasoning: 'medium' },
      }),
      sessionModel,
      registry,
    );
    expect(plan.passes[0]).toEqual({
      key: 'anthropic/claude-opus-4-6',
      label: 'anthropic/claude-opus-4-6 (low)',
      reasoning: 'low',
    });
    expect(plan.validator.reasoning).toBe('medium');
    expect(plan.validator.label).toBe('anthropic/claude-opus-4-6 (medium)');
  });

  test('an unknown spec degrades to the session model with a warning', () => {
    const { plan, warnings } = resolveModelPlan(
      config({ passModels: ['openai/gpt-5.5', 'openai/ghost'] }),
      sessionModel,
      registry,
    );
    expect(plan.passes.map((step) => step.key)).toEqual([
      'openai/gpt-5.5',
      'default',
      'openai/gpt-5.5',
      'default',
    ]);
    expect(warnings.some((warning) => warning.includes('openai/ghost'))).toBe(true);
  });
});
