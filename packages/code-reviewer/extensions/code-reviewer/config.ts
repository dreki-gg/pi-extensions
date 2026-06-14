/**
 * Review configuration loader.
 *
 * Reading `.code-review.json` is an Effect program against the FileSystem
 * service; a missing or malformed file falls back to defaults (never fails).
 * The Promise wrapper provides the live service for imperative call sites.
 */

import { Effect } from 'effect';
import { resolve } from 'node:path';

import { FileSystem, nodeFileSystemService } from './effects/filesystem';
import type { ModelStepConfig, ReasoningLevel, ReviewConfig, ReviewPipelineConfig } from './types';

const REASONING_LEVELS = new Set<ReasoningLevel>(['minimal', 'low', 'medium', 'high', 'xhigh']);

const CONFIG_FILE = '.code-review.json';
const DEFAULT_LENS_DIR = '.code-review/lenses';
const DEFAULT_TOOL_TIMEOUT_MS = 60_000;
const DEFAULT_TOOL_CONCURRENCY = 4;
const DEFAULT_REJECTIONS_FILE = '.code-review/rejections.jsonl';

const DEFAULT_PIPELINE: ReviewPipelineConfig = {
  passes: 5,
  validate: true,
  minVotes: 2,
  concurrency: 5,
  temperature: 0.4,
  maxFindings: 50,
  recordRejections: true,
};

function defaultConfig(): ReviewConfig {
  return {
    lensDir: DEFAULT_LENS_DIR,
    defaultLenses: [],
    toolTimeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
    toolConcurrency: DEFAULT_TOOL_CONCURRENCY,
    review: { ...DEFAULT_PIPELINE },
    rejectionsFile: DEFAULT_REJECTIONS_FILE,
  };
}

/** Coerce a config value to a non-negative integer (0 allowed: disables passes). */
function nonNegativeIntOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

/** Coerce a config value to a number within [min, max]. */
function clampNumberOr(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Coerce a config value to a model step: a non-empty spec string or
 *  `{ model, reasoning }`. Returns undefined for anything else. */
function parseModelStep(value: unknown): ModelStepConfig | undefined {
  if (typeof value === 'string') return value.trim() ? value.trim() : undefined;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const model = typeof record.model === 'string' ? record.model.trim() : '';
    if (!model) return undefined;
    const reasoning =
      typeof record.reasoning === 'string' &&
      REASONING_LEVELS.has(record.reasoning as ReasoningLevel)
        ? (record.reasoning as ReasoningLevel)
        : undefined;
    return reasoning ? { model, reasoning } : { model };
  }
  return undefined;
}

/** Coerce a config value to a non-empty array of model steps, or undefined. */
function parseModelStepArray(value: unknown): ModelStepConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps = value
    .map(parseModelStep)
    .filter((step): step is ModelStepConfig => step !== undefined);
  return steps.length > 0 ? steps : undefined;
}

function parsePipeline(raw: unknown): ReviewPipelineConfig {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_PIPELINE };
  const review = raw as Record<string, unknown>;
  const passes = nonNegativeIntOr(review.passes, DEFAULT_PIPELINE.passes);
  return {
    passes,
    validate: typeof review.validate === 'boolean' ? review.validate : DEFAULT_PIPELINE.validate,
    minVotes: positiveIntOr(review.minVotes, DEFAULT_PIPELINE.minVotes),
    // Default concurrency tracks pass count so all passes fan out at once.
    concurrency: positiveIntOr(review.concurrency, Math.max(1, passes)),
    temperature: clampNumberOr(review.temperature, DEFAULT_PIPELINE.temperature, 0, 2),
    maxFindings: positiveIntOr(review.maxFindings, DEFAULT_PIPELINE.maxFindings),
    recordRejections:
      typeof review.recordRejections === 'boolean'
        ? review.recordRejections
        : DEFAULT_PIPELINE.recordRejections,
    passModel: parseModelStep(review.passModel),
    passModels: parseModelStepArray(review.passModels),
    validateModel: parseModelStep(review.validateModel),
  };
}

/** Coerce a config value to a positive integer, falling back when absent/invalid. */
function positiveIntOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

export function loadConfigEffect(cwd: string): Effect.Effect<ReviewConfig, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const raw = yield* fs.readTextFile(getConfigPath(cwd)).pipe(Effect.either);
    if (raw._tag === 'Left') return defaultConfig();

    try {
      const parsed = JSON.parse(raw.right) as Partial<ReviewConfig>;
      return {
        lensDir: parsed.lensDir ?? DEFAULT_LENS_DIR,
        defaultLenses: parsed.defaultLenses ?? [],
        toolTimeoutMs: positiveIntOr(parsed.toolTimeoutMs, DEFAULT_TOOL_TIMEOUT_MS),
        toolConcurrency: positiveIntOr(parsed.toolConcurrency, DEFAULT_TOOL_CONCURRENCY),
        review: parsePipeline((parsed as { review?: unknown }).review),
        rejectionsFile:
          typeof parsed.rejectionsFile === 'string' && parsed.rejectionsFile.trim()
            ? parsed.rejectionsFile.trim()
            : DEFAULT_REJECTIONS_FILE,
      };
    } catch {
      // Malformed config — fall back to defaults.
      return defaultConfig();
    }
  });
}

export function loadConfig(cwd: string): Promise<ReviewConfig> {
  return Effect.runPromise(
    loadConfigEffect(cwd).pipe(Effect.provideService(FileSystem, nodeFileSystemService)),
  );
}

export function getLensDir(cwd: string, config: ReviewConfig): string {
  return resolve(cwd, config.lensDir);
}

export function getConfigPath(cwd: string): string {
  return resolve(cwd, CONFIG_FILE);
}
