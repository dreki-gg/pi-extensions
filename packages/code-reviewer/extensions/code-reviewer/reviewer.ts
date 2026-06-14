import { platform } from 'node:os';
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import { Effect } from 'effect';

import type { DiffSource } from './diff';
import { Executor, makeExecutorService } from './effects/exec';
import type { LensConfig, LensResult, PipelineResult, ValidatedFinding } from './types';

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

/**
 * Build the shared review body fed to every pipeline pass: the diff (once) plus
 * each lens definition + its tool outputs, WITHOUT the legacy per-lens output
 * instructions (the pipeline supplies its own adversarial instructions). The
 * legacy single-pass fallback appends its instructions separately.
 */
export function buildReviewBasePrompt(lensSections: string[], diff: DiffSource): string {
  return [
    '## Changes',
    '```',
    diff.stat.trim() || '(no diffstat)',
    '```',
    '',
    buildDiffSection(diff),
    '',
    '## Review lenses (project invariants to check)',
    '',
    ...lensSections,
  ].join('\n');
}

/** Pointer to the temp file holding the full review context. */
export type ReviewPointer = { path: string; bytes: number; lines: number };

/** Round bytes to whole KB for a human-readable size (min 1KB). */
function toKb(bytes: number): number {
  return Math.max(1, Math.round(bytes / 1024));
}

/**
 * Condense a git `--stat` block into a one-line "N files, +ins -del" summary.
 * Returns '' when the diffstat has no recognizable summary line.
 */
function summarizeDiffStat(stat: string): string {
  const lastLine = stat.trim().split('\n').pop()?.trim() ?? '';
  const files = lastLine.match(/(\d+) files? changed/)?.[1];
  if (!files) return '';
  const insertions = lastLine.match(/(\d+) insertions?\(\+\)/)?.[1];
  const deletions = lastLine.match(/(\d+) deletions?\(-\)/)?.[1];
  const parts = [`${files} file${files === '1' ? '' : 's'}`];
  if (insertions) parts.push(`+${insertions}`);
  if (deletions) parts.push(`-${deletions}`);
  return parts.join(', ');
}

/**
 * Compact inline header for the single-pass fallback. The full review context
 * (diff, lenses, instructions) lives in a temp file — see {@link buildPointer} —
 * so this only names the lenses and the diff scope. Pure (no IO).
 */
export function buildInlineSummary(lensNames: string[], diff: DiffSource): string {
  const stat = summarizeDiffStat(diff.stat);
  const diffLine = stat ? `${diff.label} (${stat})` : diff.label;
  return [
    '# Code Review Summary',
    `- **Lenses**: ${lensNames.join(', ') || '(none)'}`,
    `- **Diff**: ${diffLine}`,
  ].join('\n');
}

/**
 * Inline pointer to the temp file holding the full review context. pi's tool
 * output / `read` caps are both ~50KB / 2000 lines, so the directive tells the
 * agent to page large content with `read` offset/limit. Pure (no IO).
 *
 * `mode` switches the action sentence: single-pass needs the agent to perform
 * the whole review from the file; pipeline only needs it to drill into the diff
 * behind an already-rendered finding.
 */
export function buildPointer(pointer: ReviewPointer, mode: 'single-pass' | 'pipeline'): string {
  const size = `(${pointer.lines} lines, ${toKb(pointer.bytes)}KB)`;
  if (mode === 'single-pass') {
    return [
      '📄 Full review context (diff, lens definitions, tool outputs, instructions)',
      `saved to: \`${pointer.path}\``,
      `${size}. **Read that file** to perform the review — page large content with`,
      '`read` offset/limit.',
    ].join('\n');
  }
  return [
    '---',
    `📄 Full diff + lens context saved to: \`${pointer.path}\``,
    `${size}. Use \`read\` (offset/limit) to inspect the diff behind a finding.`,
  ].join('\n');
}

const SEVERITY_EMOJI: Record<ValidatedFinding['severity'], string> = {
  blocker: '🔴',
  warning: '🟡',
  note: '🔵',
};

/** A one-line model summary, shown only when a non-default model is in play. */
function renderModelLine(telemetry: PipelineResult['telemetry']): string[] {
  const passKeys = new Set(telemetry.passModels);
  const allDefault =
    passKeys.size === 1 && passKeys.has('default') && telemetry.validatorModel === 'default';
  if (allDefault) return [];

  const passCounts = new Map<string, number>();
  for (const key of telemetry.passModels) passCounts.set(key, (passCounts.get(key) ?? 0) + 1);
  const passSummary = [...passCounts.entries()].map(([key, count]) => `${key}×${count}`).join(', ');
  return [`Models — passes: ${passSummary}; validator: ${telemetry.validatorModel}.`];
}

/** Render the validated pipeline findings into a Markdown review report. */
export function renderPipelineReport(result: PipelineResult, diff: DiffSource): string {
  const { findings, telemetry } = result;
  const counts = {
    blocker: findings.filter((finding) => finding.severity === 'blocker').length,
    warning: findings.filter((finding) => finding.severity === 'warning').length,
    note: findings.filter((finding) => finding.severity === 'note').length,
  };

  const header = [
    `# Code Review — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Reviewed ${diff.label} across ${telemetry.passes} adversarial pass(es)` +
      `${telemetry.failedPasses ? ` (${telemetry.failedPasses} failed)` : ''}.`,
    '',
    `**${findings.length} finding(s)** — ${counts.blocker} blocker, ${counts.warning} warning, ${counts.note} note.`,
    `Pipeline: ${telemetry.buckets} buckets → ${telemetry.candidates} candidates → ${telemetry.validated} validated` +
      ` (dropped ${telemetry.droppedFalsePositives} false-positive, ${telemetry.droppedLowSignal} low-signal).`,
    ...renderModelLine(telemetry),
    '',
  ];

  // A pass fails when its model call errors; failures are swallowed into 0
  // findings, so an all-failed run must NOT masquerade as a clean review.
  const someFailed = telemetry.failedPasses > 0;
  const allFailed = telemetry.passes > 0 && telemetry.failedPasses >= telemetry.passes;
  const errSuffix = telemetry.passErrorSample ? ` — e.g. ${telemetry.passErrorSample}` : '';

  if (findings.length === 0) {
    if (allFailed) {
      return [
        ...header,
        `> ⚠️ **Inconclusive — all ${telemetry.passes} review pass(es) failed${errSuffix}.**`,
        '> No analysis actually ran; this is NOT a clean result. Re-run the review',
        '> (check that the review model / pi-ai is available) before trusting it.',
      ].join('\n');
    }
    if (someFailed) {
      return [
        ...header,
        `> ⚠️ **Partial review — ${telemetry.failedPasses}/${telemetry.passes} pass(es) failed${errSuffix}.**`,
        `> The ${telemetry.passes - telemetry.failedPasses} surviving pass(es) found nothing, but coverage was reduced.`,
      ].join('\n');
    }
    return [...header, 'No bugs found that survived validation. ✅'].join('\n');
  }

  const partialWarning = someFailed
    ? [
        `> ⚠️ **Partial review — ${telemetry.failedPasses}/${telemetry.passes} pass(es) failed${errSuffix}; findings below may be incomplete.**`,
        '',
      ]
    : [];

  // Only attribute models per finding when more than one distinct model ran
  // (a bake-off); with a single model it's noise.
  const multiModel = new Set(telemetry.passModels).size > 1;
  const lines = findings.map((finding) => {
    const where = finding.line ? `\`${finding.file}:${finding.line}\`` : `\`${finding.file}\``;
    const meta = [
      `${finding.votes}/${telemetry.passes} votes`,
      `${Math.round(finding.confidence * 100)}% conf`,
      finding.category,
      multiModel && finding.models.length > 0 ? `models: ${finding.models.join(', ')}` : undefined,
      finding.previouslyRejected ? '⟲ previously rejected' : undefined,
    ]
      .filter(Boolean)
      .join(', ');
    const justification = finding.justification ? `\n  ↳ ${finding.justification}` : '';
    return `- ${SEVERITY_EMOJI[finding.severity]} **${finding.severity}** ${where} — ${finding.message} _(${meta})_${justification}`;
  });

  return [...header, ...partialWarning, '## Findings', '', ...lines].join('\n');
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

/**
 * Build the agent-facing review instructions for the single-pass fallback. The
 * diff is embedded ONCE (not per lens) followed by each lens's section — large
 * diffs would otherwise be repeated for every lens, bloating the tool output.
 * Returns '' when no lens produced a section (nothing to review).
 */
export function buildToolContext(results: LensResult[], diff: DiffSource): string {
  const sections = results.map((r) => r._lensSection).filter(Boolean) as string[];
  if (sections.length === 0) return '';

  return [
    `# Code Review — ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Changes',
    '```',
    diff.stat.trim() || '(no diffstat)',
    '```',
    '',
    'Evaluate the diff through each lens below; the tool outputs are automated analysis.',
    '',
    buildDiffSection(diff),
    '',
    '## Lenses',
    '',
    ...sections,
    '',
    '## Instructions',
    '',
    'For each lens above, review the diff against its criteria and output a JSON array of findings:',
    '',
    '```json',
    '[',
    '  { "file": "path/to/file.ts", "line": 42, "severity": "warning", "message": "Description" }',
    ']',
    '```',
    '',
    'After each lens JSON array, write a 2-3 sentence summary.',
    'If a lens has no findings, return an empty array `[]` and note the code looks good.',
  ].join('\n');
}

/** Persist the full review context somewhere durable, returning a pointer. */
export type ReviewTempWriter = (content: string) => Promise<ReviewPointer>;

type ReviewToolResult = AgentToolResult<Record<string, unknown>>;

/**
 * Assemble the single-pass fallback result. The full review context is spilled
 * to a temp file (via the injected {@link ReviewTempWriter}) so it survives
 * pi's tool-output cap; the inline payload is just a summary + pointer.
 * Degrades gracefully: an empty context yields a "no applicable lenses" notice,
 * and a temp-write failure falls back to the (truncation-prone) inline context
 * rather than throwing out of the tool.
 */
export async function buildSinglePassResult(
  args: {
    results: LensResult[];
    diff: DiffSource;
    lensNames: string[];
    availableLenses: string[];
    changedFiles: string[];
  },
  writeTemp: ReviewTempWriter,
  onUpdate?: AgentToolUpdateCallback,
): Promise<ReviewToolResult> {
  const fullContext = buildToolContext(args.results, args.diff);
  const baseDetails: Record<string, unknown> = {
    mode: 'single-pass',
    lensCount: args.lensNames.length,
    availableLenses: args.availableLenses,
    changedFiles: args.changedFiles,
  };

  // No lens produced any context (e.g. the requested lenses matched none of the
  // available ones) — there is nothing to review, so don't point the agent at
  // an empty temp file.
  if (!fullContext.trim()) {
    return {
      content: [
        {
          type: 'text',
          text: `No applicable lenses for this review. Available: ${args.availableLenses.join(', ') || '(none)'}.`,
        },
      ],
      details: baseDetails,
    };
  }

  try {
    const pointer = await writeTemp(fullContext);
    const summary = `${buildInlineSummary(args.lensNames, args.diff)}\n\n${buildPointer(pointer, 'single-pass')}`;
    return {
      content: [{ type: 'text', text: summary }],
      details: { ...baseDetails, contextFile: pointer.path },
    };
  } catch (cause) {
    onUpdate?.({
      content: [{ type: 'text', text: 'temp-file write failed — returning inline context' }],
      details: { writeError: cause instanceof Error ? cause.message : String(cause) },
    });
    return { content: [{ type: 'text', text: fullContext }], details: baseDetails };
  }
}

/**
 * Assemble the pipeline result. The validated findings are the valuable output
 * and stay inline; the diff + lens context is spilled to a temp file (via the
 * injected {@link ReviewTempWriter}) purely so the agent can drill into the
 * diff behind a finding. A write failure must NOT discard a completed pipeline,
 * so on failure the findings are returned WITHOUT a pointer.
 */
export async function buildPipelineResult(
  args: {
    pipeline: PipelineResult;
    diff: DiffSource;
    basePrompt: string;
    lensNames: string[];
    availableLenses: string[];
    changedFiles: string[];
  },
  writeTemp: ReviewTempWriter,
  onUpdate?: AgentToolUpdateCallback,
): Promise<ReviewToolResult> {
  const report = renderPipelineReport(args.pipeline, args.diff);
  let text = report;
  let contextFile: string | undefined;
  try {
    const pointer = await writeTemp(args.basePrompt);
    text = `${report}\n\n${buildPointer(pointer, 'pipeline')}`;
    contextFile = pointer.path;
  } catch (cause) {
    onUpdate?.({
      content: [
        { type: 'text', text: 'temp-file write failed — findings returned without diff pointer' },
      ],
      details: { writeError: cause instanceof Error ? cause.message : String(cause) },
    });
  }
  return {
    content: [{ type: 'text', text }],
    details: {
      mode: 'pipeline',
      lensCount: args.lensNames.length,
      availableLenses: args.availableLenses,
      changedFiles: args.changedFiles,
      findings: args.pipeline.findings,
      telemetry: args.pipeline.telemetry,
      ...(contextFile ? { contextFile } : {}),
    },
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
