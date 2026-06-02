import { platform } from 'node:os';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Effect } from 'effect';

import type { DiffSource } from './diff';
import { Executor, makeExecutorService } from './effects/exec';
import type { LensConfig, LensResult } from './types';

const isWindows = platform() === 'win32';

export type ToolRunOptions = { timeoutMs: number; concurrency: number };

/**
 * Run a set of project tool commands ONCE, deduped and concurrently, and
 * collect their output keyed by the original command string.
 *
 * Tools are deduped across lenses by the caller (and again here defensively),
 * so a command shared by several lenses runs a single time — not once per
 * lens. Each command is shelled out with a bounded timeout; a failure or
 * timeout degrades to a sentinel string instead of failing the whole review.
 */
export function runToolsEffect(
  cwd: string,
  tools: string[],
  options: ToolRunOptions,
  signal?: AbortSignal,
): Effect.Effect<Record<string, string>, never, Executor> {
  return Effect.gen(function* () {
    const unique = [...new Set(tools)];
    if (unique.length === 0 || signal?.aborted) return {};

    const executor = yield* Executor;

    const entries = yield* Effect.forEach(
      unique,
      (tool) =>
        Effect.gen(function* () {
          if (signal?.aborted) return [tool, '(skipped: review aborted)'] as const;

          const [shell, shellArgs] = isWindows ? ['cmd', ['/c', tool]] : ['sh', ['-c', tool]];
          const result = yield* executor
            .exec(shell, shellArgs as string[], { cwd, timeout: options.timeoutMs, signal })
            .pipe(Effect.either);

          const output =
            result._tag === 'Right'
              ? result.right.stdout || result.right.stderr || '(no output)'
              : `(tool failed or timed out: ${tool})`;
          return [tool, output] as const;
        }),
      { concurrency: Math.max(1, options.concurrency) },
    );

    return Object.fromEntries(entries);
  });
}

/** Pick the subset of already-run tool outputs that a given lens declares. */
export function pickLensToolOutputs(
  lens: LensConfig,
  allOutputs: Record<string, string>,
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const tool of lens.tools) {
    if (tool in allOutputs) picked[tool] = allOutputs[tool];
  }
  return picked;
}

/** Build the shared diff section of the review prompt (included once). */
export function buildDiffSection(diff: DiffSource): string {
  const parts: string[] = [];
  const maxDiffLen = 50_000;
  const diffTruncated = diff.diff.length > maxDiffLen;
  // Cut at the last newline within budget so we never emit a half-line of
  // diff (which reads as a corrupt hunk); fall back to a hard slice if a
  // single line already exceeds the budget.
  const body = diffTruncated
    ? diff.diff.slice(0, Math.max(diff.diff.lastIndexOf('\n', maxDiffLen), 0) || maxDiffLen)
    : diff.diff;

  parts.push(`## Diff (${diff.label})`);
  parts.push('```diff');
  parts.push(body);
  parts.push('```');
  if (diffTruncated) {
    parts.push(
      `> ⚠️ Diff truncated (${diff.diff.length} chars → ~${maxDiffLen}). Some files may not appear above; re-run scoped with \`--base\` or per-area if needed.`,
    );
  }
  parts.push('');
  parts.push('## Diff Stats');
  parts.push('```');
  parts.push(diff.stat);
  parts.push('```');

  return parts.join('\n');
}

/** Build the lens-specific section of the review prompt (no diff duplication). */
export function buildLensSection(
  lens: LensConfig,
  lensContent: string,
  toolOutputs: Record<string, string>,
): string {
  const parts: string[] = [];

  parts.push(`### Lens: ${lens.name}`);
  parts.push('');
  parts.push('#### Lens Definition');
  parts.push(lensContent);

  if (Object.keys(toolOutputs).length > 0) {
    parts.push('');
    parts.push('#### Tool Outputs');
    for (const [cmd, output] of Object.entries(toolOutputs)) {
      parts.push(`##### \`${cmd}\``);
      parts.push('```');
      parts.push(output.slice(0, 20_000));
      parts.push('```');
    }
  }

  parts.push('');
  parts.push('#### Severity levels');
  if (lens.severityRules.blocker) parts.push(`- **blocker**: ${lens.severityRules.blocker}`);
  if (lens.severityRules.warning) parts.push(`- **warning**: ${lens.severityRules.warning}`);
  if (lens.severityRules.note) parts.push(`- **note**: ${lens.severityRules.note}`);

  return parts.join('\n');
}

/**
 * Build the lens result from PRE-COMPUTED tool outputs. Pure — no IO — so tool
 * execution happens once up front (see {@link runToolsEffect}) and is shared
 * across every lens that declares the same command.
 */
export function buildLensResult(
  lens: LensConfig,
  lensContent: string,
  toolOutputs: Record<string, string>,
): LensResult {
  return {
    lens: lens.name,
    findings: [],
    summary: '',
    toolOutputs,
    _lensSection: buildLensSection(lens, lensContent, toolOutputs),
  };
}

/** Promise wrapper: run a deduped tool set once, building a live Executor from `pi`. */
export function runTools(
  pi: Pick<ExtensionAPI, 'exec'>,
  cwd: string,
  tools: string[],
  options: ToolRunOptions,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  return Effect.runPromise(
    runToolsEffect(cwd, tools, options, signal).pipe(
      Effect.provideService(Executor, makeExecutorService(pi)),
    ),
  );
}
