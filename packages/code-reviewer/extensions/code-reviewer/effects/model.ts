/**
 * Reviewer service — wraps the session's current model so a single completion
 * becomes an injectable, typed Effect. The self-driving pipeline (see
 * `passes.ts`) depends on this Tag; the live implementation drives
 * `@earendil-works/pi-ai`'s `completeSimple` over `ctx.model`, while tests
 * provide a deterministic fake instead of calling a real provider.
 *
 * `@earendil-works/pi-ai` is an OPTIONAL peer dependency, so the runtime import
 * is deferred (`import()`), reached only when the harness actually hands us a
 * model. The extension stays loadable in environments without pi-ai.
 */

import type { Api, AssistantMessage, Model, TextContent } from '@earendil-works/pi-ai';
import { Context, Effect } from 'effect';

import { ModelError } from '../errors';
import type { ReasoningLevel } from '../types';

/** The model key meaning "use the session's current model". */
export const DEFAULT_MODEL_KEY = 'default';

export type CompletionRequest = {
  /** Which model to run this call on — {@link DEFAULT_MODEL_KEY} or a key the
   *  resolution map holds. Unknown keys fall back to the default model. */
  modelKey: string;
  system: string;
  user: string;
  /** Sampling temperature; the pipeline jitters this per pass. */
  temperature?: number;
  /** Reasoning/thinking effort for this call (provider-dependent). */
  reasoning?: ReasoningLevel;
  /** Identifies which pipeline stage is calling, for error context. */
  stage: string;
  signal?: AbortSignal;
};

export interface ReviewerService {
  readonly complete: (request: CompletionRequest) => Effect.Effect<string, ModelError>;
}

export class Reviewer extends Context.Tag('CodeReviewer/Reviewer')<Reviewer, ReviewerService>() {}

/** Resolved models the pipeline can run against: a default (session) model plus
 *  any config-specified models keyed by their spec string. */
export type ModelResolution = {
  defaultModel: Model<Api>;
  byKey: Map<string, Model<Api>>;
};

/** Resolve a config model spec to a registered model. Accepts "provider/id",
 *  a bare model `id`, a `"provider/id"` composite, or a display `name`. */
export function resolveModelSpec(
  registry: { getAll: () => Model<Api>[] },
  spec: string,
): Model<Api> | undefined {
  const trimmed = spec.trim();
  if (!trimmed) return undefined;
  const all = registry.getAll();

  const slash = trimmed.indexOf('/');
  if (slash > 0) {
    const provider = trimmed.slice(0, slash);
    const id = trimmed.slice(slash + 1);
    const exact = all.find((model) => model.provider === provider && model.id === id);
    if (exact) return exact;
  }
  return (
    all.find((model) => model.id === trimmed) ??
    all.find((model) => `${model.provider}/${model.id}` === trimmed) ??
    all.find((model) => model.name === trimmed)
  );
}

/** Flatten an assistant message to its plain-text content (drop thinking/tool). */
export function extractText(message: AssistantMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** Build a live Reviewer that routes each call to the model named by its
 *  `modelKey` (falling back to the default/session model) via pi-ai. */
export function makeReviewerService(resolution: ModelResolution): ReviewerService {
  return {
    complete: (request) =>
      Effect.tryPromise({
        try: async () => {
          const { completeSimple } = await import('@earendil-works/pi-ai');
          const model = resolution.byKey.get(request.modelKey) ?? resolution.defaultModel;
          const message = await completeSimple(
            model,
            {
              systemPrompt: request.system,
              messages: [{ role: 'user', content: request.user, timestamp: Date.now() }],
            },
            {
              temperature: request.temperature,
              reasoning: request.reasoning,
              signal: request.signal,
            },
          );
          if (message.stopReason === 'error') {
            throw new Error(message.errorMessage ?? 'model returned an error stop reason');
          }
          return extractText(message);
        },
        catch: (cause) => new ModelError({ stage: request.stage, cause }),
      }),
  };
}
