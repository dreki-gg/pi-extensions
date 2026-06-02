/**
 * Resolve the per-step model plan for a review run.
 *
 * The pipeline can run each step on a different model AND reasoning level so you
 * can A/B which models / efforts review best / fastest / cheapest. Config
 * supplies steps as a spec string ("provider/id", a bare id, or a display name)
 * or `{ model, reasoning }`. This module turns them into a {@link ModelResolution}
 * (key → real model) plus a {@link ModelPlan} (which model + reasoning each pass
 * and the validator use). Unresolvable specs degrade to the session model with a
 * warning, so a typo never fails the review.
 */

import type { Api, Model } from '@earendil-works/pi-ai';

import { DEFAULT_MODEL_KEY, type ModelResolution, resolveModelSpec } from './effects/model';
import type { ModelAssignment, ModelPlan, ModelStepConfig, ReviewPipelineConfig } from './types';

export type ResolvedModelPlan = {
  resolution: ModelResolution;
  plan: ModelPlan;
  warnings: string[];
};

function stepParts(step: ModelStepConfig | undefined): {
  spec?: string;
  reasoning?: ModelAssignment['reasoning'];
} {
  if (step === undefined) return {};
  if (typeof step === 'string') return { spec: step };
  return { spec: step.model, reasoning: step.reasoning };
}

function labelFor(key: string, reasoning?: ModelAssignment['reasoning']): string {
  return reasoning ? `${key} (${reasoning})` : key;
}

export function resolveModelPlan(
  review: ReviewPipelineConfig,
  defaultModel: Model<Api>,
  registry: { getAll: () => Model<Api>[] },
): ResolvedModelPlan {
  const byKey = new Map<string, Model<Api>>();
  const warnings: string[] = [];

  // Resolve one step to an assignment; cache resolved models so a spec
  // referenced by several passes only resolves once.
  const assign = (step: ModelStepConfig | undefined): ModelAssignment => {
    const { spec, reasoning } = stepParts(step);
    if (!spec || !spec.trim()) {
      return { key: DEFAULT_MODEL_KEY, label: labelFor(DEFAULT_MODEL_KEY, reasoning), reasoning };
    }
    const key = spec.trim();
    if (key !== DEFAULT_MODEL_KEY && !byKey.has(key)) {
      const model = resolveModelSpec(registry, key);
      if (!model) {
        warnings.push(`review model "${key}" not found — using the session model for those steps`);
        return { key: DEFAULT_MODEL_KEY, label: labelFor(DEFAULT_MODEL_KEY, reasoning), reasoning };
      }
      byKey.set(key, model);
    }
    return { key, label: labelFor(key, reasoning), reasoning };
  };

  // passModels (rotated round-robin) overrides passModel overrides default.
  const passSteps =
    review.passModels && review.passModels.length > 0 ? review.passModels : [review.passModel];

  const passes: ModelAssignment[] = [];
  for (let index = 0; index < review.passes; index += 1) {
    passes.push(assign(passSteps[index % passSteps.length]));
  }
  const validator = assign(review.validateModel);

  return { resolution: { defaultModel, byKey }, plan: { passes, validator }, warnings };
}

/** Default plan: every step on the session model. Used as a fallback and in tests. */
export function defaultModelPlan(passes: number): ModelPlan {
  const step: ModelAssignment = { key: DEFAULT_MODEL_KEY, label: DEFAULT_MODEL_KEY };
  return {
    passes: Array.from({ length: passes }, () => ({ ...step })),
    validator: { ...step },
  };
}
