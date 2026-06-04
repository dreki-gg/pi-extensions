import { completeSimple } from '@earendil-works/pi-ai';

type EnvLike = Record<string, string | undefined>;

const DEFAULT_PROVIDER = 'google';
const DEFAULT_MODEL_ID = 'gemini-2.5-flash';

export const DEFAULT_ANALYSIS_PROMPT =
  'Describe this screenshot in detail. Identify UI elements, forms, inputs, buttons, ' +
  'shapes, layout structure, and any visible text. Be precise and thorough.';

export type AnalysisModel = {
  provider: string;
  modelId: string;
};

/**
 * Resolve the model used for screenshot analysis from `WEB_SCREENSHOT_MODEL`.
 * Format: `provider:modelId`. A bare value (no colon) is treated as a model id
 * under the default `google` provider. Defaults to `google:gemini-2.5-flash`.
 */
export function resolveAnalysisModel(env: EnvLike = {}): AnalysisModel {
  const raw = env.WEB_SCREENSHOT_MODEL?.trim();
  if (!raw) {
    return { provider: DEFAULT_PROVIDER, modelId: DEFAULT_MODEL_ID };
  }

  const separatorIndex = raw.indexOf(':');
  if (separatorIndex === -1) {
    return { provider: DEFAULT_PROVIDER, modelId: raw };
  }

  const provider = raw.slice(0, separatorIndex).trim() || DEFAULT_PROVIDER;
  const modelId = raw.slice(separatorIndex + 1).trim() || DEFAULT_MODEL_ID;
  return { provider, modelId };
}

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

/**
 * Resolve whether screenshot analysis is enabled. An explicit tool param wins;
 * otherwise the `WEB_SCREENSHOT_ANALYZE` env default applies.
 */
export function resolveAnalyzeEnabled(param: boolean | undefined, env: EnvLike = {}): boolean {
  if (param !== undefined) {
    return param;
  }
  const raw = env.WEB_SCREENSHOT_ANALYZE?.trim().toLowerCase();
  return raw !== undefined && TRUTHY_VALUES.has(raw);
}

// Minimal structural types to avoid leaking heavy pi-ai generics here.
type ResolvedAuth =
  | { ok: true; apiKey?: string; headers?: Record<string, string> }
  | { ok: false; error: string };

export type AnalysisModelRegistry = {
  find(provider: string, modelId: string): unknown;
  getApiKeyAndHeaders(model: unknown): Promise<ResolvedAuth>;
};

type CompleteSimpleFn = typeof completeSimple;

export type AnalyzeScreenshotOptions = {
  modelRegistry: AnalysisModelRegistry;
  imageBase64: string;
  prompt?: string;
  mimeType?: string;
  signal?: AbortSignal;
  env?: EnvLike;
  /** Injectable for tests. Defaults to pi-ai `completeSimple`. */
  complete?: CompleteSimpleFn;
};

export type AnalyzeScreenshotResult = {
  text: string;
  model: string;
};

/**
 * Send a screenshot to the configured vision model and return its text analysis.
 */
export async function analyzeScreenshot(
  options: AnalyzeScreenshotOptions,
): Promise<AnalyzeScreenshotResult> {
  const env = options.env ?? {};
  const { provider, modelId } = resolveAnalysisModel(env);
  const modelLabel = `${provider}:${modelId}`;

  const model = options.modelRegistry.find(provider, modelId);
  if (!model) {
    throw new Error(
      `Screenshot analysis model "${modelLabel}" not found. ` +
        'Set WEB_SCREENSHOT_MODEL to an available "provider:modelId".',
    );
  }

  const auth = await options.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    throw new Error(`Screenshot analysis model "${modelLabel}" has no usable auth: ${auth.error}`);
  }

  const complete = options.complete ?? completeSimple;
  const context = {
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: options.prompt ?? DEFAULT_ANALYSIS_PROMPT },
          {
            type: 'image' as const,
            data: options.imageBase64,
            mimeType: options.mimeType ?? 'image/png',
          },
        ],
        timestamp: Date.now(),
      },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await complete(model as any, context as any, {
    apiKey: auth.apiKey,
    headers: auth.headers,
    signal: options.signal,
  });

  const text = result.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim();

  return { text, model: modelLabel };
}
