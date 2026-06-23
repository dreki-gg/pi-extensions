import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { loadConfig, getLensDir } from '../config';
import { collectDiff, getChangedFiles } from '../diff';
import { discoverLenses, getLensContent } from '../lenses';
import { resolveRepoCwd } from '../resolve-cwd';
import { resolveModelPlan } from '../model-plan';
import { runPipeline } from '../passes';
import {
  appendRejections,
  applyRejections,
  loadRejections,
  toRejectionRecords,
} from '../rejections';
import {
  buildLensResult,
  buildPipelineResult,
  buildReviewBasePrompt,
  buildSinglePassResult,
  pickLensToolOutputs,
  runTools,
} from '../reviewer';
import type { ReviewPointer } from '../reviewer';
import type { LensResult, ReviewConfig } from '../types';

/**
 * Spill the full review context to a temp Markdown file and return a pointer
 * (path + byte size + line count). Both pi's tool-output and `read` caps are
 * ~50KB / 2000 lines, so large reviews would otherwise be truncated and lost
 * on compaction. The on-disk file survives compaction and can be paged.
 *
 * Node-only IO (no Bun) per the extension runtime constraint.
 */
async function writeReviewTempFile(content: string): Promise<ReviewPointer> {
  const path = join(tmpdir(), `pi-code-review-${Date.now()}.md`);
  await writeFile(path, content, 'utf8');
  return {
    path,
    bytes: Buffer.byteLength(content, 'utf8'),
    lines: content.split('\n').length,
  };
}

export function registerReviewTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'code_review',
    label: 'Code Review',
    description:
      'Run a multi-lens code review on the current working directory changes. Returns review findings grouped by lens.',
    promptSnippet: 'Run a multi-lens code review against working directory changes',
    promptGuidelines: [
      'Use code_review when the user asks to review their changes, check code quality, or before committing.',
      'code_review reads lens definitions from .code-review/lenses/ in the project root.',
    ],
    parameters: Type.Object({
      lenses: Type.Optional(
        Type.Array(Type.String(), {
          description:
            'Specific lenses to apply. If omitted, uses project defaults or all available.',
        }),
      ),
      base: Type.Optional(
        Type.String({
          description: 'Git ref to diff against (e.g., "main", "HEAD~3"). Defaults to HEAD.',
        }),
      ),
      staged: Type.Optional(
        Type.Boolean({
          description: 'Review only staged changes instead of all working directory changes.',
        }),
      ),
      cwd: Type.Optional(
        Type.String({
          description:
            'Override directory for git/config/lens resolution (e.g. a worktree or sibling repo). Resolved relative to the session directory and validated as a git work tree. The session directory is left unchanged.',
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      let cwd: string;
      try {
        cwd = await resolveRepoCwd(pi, ctx.cwd, params.cwd);
      } catch (cause) {
        return {
          content: [
            {
              type: 'text',
              text: `cwd "${params.cwd}" is not a git work tree (${cause instanceof Error ? cause.message : String(cause)}).`,
            },
          ],
          details: {},
        };
      }
      const config = await loadConfig(cwd);
      const lensDir = getLensDir(cwd, config);
      const available = await discoverLenses(lensDir);

      if (available.size === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No lenses found in ${config.lensDir}. Run /review-init to scaffold a default config, or create .code-review/lenses/*.md files.`,
            },
          ],
          details: {},
        };
      }

      const lensNames = resolveLensNames(params.lenses, config, available);

      ctx.ui.setStatus('code-review', '🔍 Collecting diff...');
      const diff = await collectDiff(pi, cwd, {
        base: params.base,
        staged: params.staged,
      });

      if (!diff.diff.trim()) {
        ctx.ui.setStatus('code-review', undefined);
        return {
          content: [{ type: 'text', text: 'No changes to review.' }],
          details: {},
        };
      }

      const selected = lensNames.map((name) => available.get(name)!);

      // Run the DISTINCT tool set once (deduped across lenses), concurrently —
      // not once per lens. A command shared by several lenses executes a single
      // time and its output is shared.
      const allTools = [...new Set(selected.flatMap((lens) => lens.tools))];
      if (allTools.length > 0) {
        ctx.ui.setStatus('code-review', `🔍 Running ${allTools.length} tool(s)...`);
      }
      const toolOutputs = await runTools(
        pi,
        cwd,
        allTools,
        { timeoutMs: config.toolTimeoutMs, concurrency: config.toolConcurrency },
        signal,
      );

      const results: LensResult[] = [];
      for (let i = 0; i < lensNames.length; i++) {
        if (signal?.aborted) break;

        const name = lensNames[i];
        const progressMsg = `Lens ${i + 1}/${lensNames.length}: ${name}`;
        ctx.ui.setStatus('code-review', `🔍 ${progressMsg}`);
        onUpdate?.({
          content: [{ type: 'text', text: progressMsg }],
          details: { currentLens: name, lensIndex: i + 1, totalLenses: lensNames.length },
        });

        const lens = selected[i];
        const content = (await getLensContent(lensDir, name)) ?? '';
        results.push(buildLensResult(lens, content, pickLensToolOutputs(lens, toolOutputs)));
      }

      const changedFiles = await getChangedFiles(pi, cwd, {
        base: params.base,
        staged: params.staged,
      });

      // Self-driving path: when a model is available and passes are enabled,
      // the tool runs the Bugbot-style pipeline itself (parallel adversarial
      // passes → bucket → majority vote → validate) and returns FINISHED,
      // validated findings — not a prompt for a single downstream pass.
      const lensSections = results.map((result) => result._lensSection).filter(Boolean) as string[];
      if (ctx.model && config.review.passes > 0 && lensSections.length > 0 && !signal?.aborted) {
        try {
          const { resolution, plan, warnings } = resolveModelPlan(
            config.review,
            ctx.model,
            ctx.modelRegistry,
          );
          for (const warning of warnings) ctx.ui.notify(warning, 'warning');
          const basePrompt = buildReviewBasePrompt(lensSections, diff);
          const pipeline = await runPipeline(
            resolution,
            plan,
            basePrompt,
            config.review,
            {
              onStage: (stage) => {
                ctx.ui.setStatus('code-review', `🔍 ${stage}...`);
                onUpdate?.({ content: [{ type: 'text', text: stage }], details: { stage } });
              },
            },
            signal,
          );
          ctx.ui.setStatus('code-review', undefined);
          // Every pass failed (e.g. the review model/pi-ai was unavailable for
          // each call). The swallowed failures would render as a misleading
          // "0 findings" report — instead, degrade to the single-pass prompt so
          // the reviewing agent still produces a real review.
          const allPassesFailed =
            config.review.passes > 0 && pipeline.telemetry.failedPasses >= config.review.passes;
          if (!allPassesFailed) {
            // Recorded rejections: downrank+tag findings the validator refuted on
            // a previous run, then persist this run's false-positives. All FS is
            // best-effort — it must never break a completed review.
            if (config.review.recordRejections) {
              const rejectionsPath = join(cwd, config.rejectionsFile);
              const past = await loadRejections(rejectionsPath);
              pipeline.findings = applyRejections(pipeline.findings, past);
              await appendRejections(rejectionsPath, toRejectionRecords(pipeline.rejected));
            }
            return buildPipelineResult(
              {
                pipeline,
                diff,
                basePrompt,
                lensNames,
                availableLenses: [...available.keys()],
                changedFiles,
              },
              writeReviewTempFile,
              onUpdate,
            );
          }
          onUpdate?.({
            content: [{ type: 'text', text: 'all review passes failed — single-pass fallback' }],
            details: {
              failedPasses: pipeline.telemetry.failedPasses,
              passError: pipeline.telemetry.passErrorSample,
            },
          });
        } catch (cause) {
          // Pipeline failed hard (e.g. model/pi-ai unavailable at runtime) —
          // degrade to the single-pass prompt instead of failing the review.
          ctx.ui.setStatus('code-review', undefined);
          onUpdate?.({
            content: [{ type: 'text', text: 'pipeline unavailable — single-pass fallback' }],
            details: { pipelineError: cause instanceof Error ? cause.message : String(cause) },
          });
        }
      }

      ctx.ui.setStatus('code-review', undefined);

      // Fallback: spill the full single-pass review context to a temp file and
      // return a compact summary + pointer (degrades gracefully on empty
      // context or a write failure). Used when no model is available (e.g.
      // print mode) or passes are disabled in config.
      //
      // This is the PRIMARY truncation culprit: the full context embeds the
      // diff (up to 50KB) plus every lens's tool outputs (20KB each), which
      // easily blows past pi's 50KB tool-output cap.
      return buildSinglePassResult(
        {
          results,
          diff,
          lensNames,
          availableLenses: [...available.keys()],
          changedFiles,
        },
        writeReviewTempFile,
        onUpdate,
      );
    },
  });
}

function resolveLensNames(
  requested: string[] | undefined,
  config: ReviewConfig,
  available: Map<string, unknown>,
): string[] {
  if (requested && requested.length > 0) {
    return requested.filter((l) => available.has(l));
  }
  if (config.defaultLenses.length > 0) {
    return config.defaultLenses.filter((l) => available.has(l));
  }
  return [...available.keys()];
}

