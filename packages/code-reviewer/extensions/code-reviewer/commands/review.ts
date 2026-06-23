import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { loadConfig, getLensDir } from '../config';
import { collectDiff } from '../diff';
import { discoverLenses, getLensContent } from '../lenses';
import { resolveModelPlan } from '../model-plan';
import { runPipeline } from '../passes';
import {
  buildDiffSection,
  buildLensResult,
  buildReviewBasePrompt,
  pickLensToolOutputs,
  renderPipelineReport,
  runTools,
} from '../reviewer';
import { parseReviewArgs } from '../parse-args';
import { resolveRepoCwd } from '../resolve-cwd';

export function registerReviewCommand(pi: ExtensionAPI) {
  pi.registerCommand('review', {
    description:
      'Run a multi-lens code review on working directory changes. Usage: /review [--lens name,...] [--base ref] [--staged] [--repo dir]',
    handler: async (args, ctx) => {
      const parsed = parseReviewArgs(args ?? '');

      // Override directory for git/config/lens resolution (worktrees, sibling
      // repos). Resolved relative to the session CWD and validated; the session
      // CWD itself is left unchanged.
      let cwd: string;
      try {
        cwd = await resolveRepoCwd(pi, ctx.cwd, parsed.repo);
      } catch (cause) {
        ctx.ui.notify(
          `--repo ${parsed.repo} is not a git work tree (${cause instanceof Error ? cause.message : String(cause)})`,
          'error',
        );
        return;
      }

      const config = await loadConfig(cwd);
      const lensDir = getLensDir(cwd, config);
      const available = await discoverLenses(lensDir);

      if (available.size === 0) {
        ctx.ui.notify(
          `No lenses found in ${config.lensDir}. Run /review-init to scaffold a default config.`,
          'warning',
        );
        return;
      }

      const lensNames = resolveLensNames(parsed.lenses, config.defaultLenses, available, (msg) =>
        ctx.ui.notify(msg, 'warning'),
      );

      if (lensNames.length === 0) {
        ctx.ui.notify('No lenses selected', 'warning');
        return;
      }

      ctx.ui.setStatus('code-review', '🔍 Collecting diff...');
      const diff = await collectDiff(pi, cwd, {
        base: parsed.base,
        staged: parsed.staged,
      });

      if (!diff.diff.trim()) {
        ctx.ui.setStatus('code-review', undefined);
        ctx.ui.notify('No changes to review', 'info');
        return;
      }

      ctx.ui.notify(`Reviewing ${diff.label} through ${lensNames.length} lens(es)...`, 'info');

      const selected = lensNames.map((name) => available.get(name)!);

      // Run the DISTINCT tool set once (deduped across lenses), concurrently.
      const allTools = [...new Set(selected.flatMap((lens) => lens.tools))];
      ctx.ui.setStatus('code-review', `🔍 Running ${allTools.length} tool(s)...`);
      const toolOutputs = await runTools(pi, cwd, allTools, {
        timeoutMs: config.toolTimeoutMs,
        concurrency: config.toolConcurrency,
      });

      const lensSections: string[] = [];
      for (let i = 0; i < lensNames.length; i++) {
        const name = lensNames[i];
        ctx.ui.setStatus('code-review', `🔍 Lens ${i + 1}/${lensNames.length}: ${name}`);

        const lens = selected[i];
        const content = (await getLensContent(lensDir, name)) ?? '';
        const result = buildLensResult(lens, content, pickLensToolOutputs(lens, toolOutputs));
        if (result._lensSection) lensSections.push(result._lensSection);
      }

      ctx.ui.setStatus('code-review', undefined);

      // Self-driving path: run the Bugbot-style pipeline in-command and deliver
      // the validated report in-session for discussion. Mirrors the tool.
      if (ctx.model && config.review.passes > 0 && lensSections.length > 0) {
        try {
          const { resolution, plan, warnings } = resolveModelPlan(
            config.review,
            ctx.model,
            ctx.modelRegistry,
          );
          for (const warning of warnings) ctx.ui.notify(warning, 'warning');
          const basePrompt = buildReviewBasePrompt(lensSections, diff);
          const pipeline = await runPipeline(resolution, plan, basePrompt, config.review, {
            onStage: (stage) => ctx.ui.setStatus('code-review', `🔍 ${stage}...`),
          });
          ctx.ui.setStatus('code-review', undefined);
          pi.sendUserMessage(renderPipelineReport(pipeline, diff), { deliverAs: 'followUp' });
          return;
        } catch (cause) {
          ctx.ui.setStatus('code-review', undefined);
          ctx.ui.notify(
            `Pipeline unavailable (${cause instanceof Error ? cause.message : String(cause)}) — single-pass fallback`,
            'warning',
          );
        }
      }

      const combinedPrompt = [
        `Review the following changes through ${lensNames.length} lens(es): ${lensNames.join(', ')}.`,
        '',
        'For each lens, evaluate the diff against its criteria and produce findings.',
        'Output your review as a structured report with sections per lens.',
        '',
        buildDiffSection(diff),
        '',
        '## Lenses',
        '',
        ...lensSections,
        '',
        '## Instructions',
        '',
        'For each lens above, review the diff and output a JSON array of findings:',
        '',
        '```json',
        '[',
        '  { "file": "path/to/file.ts", "line": 42, "severity": "warning", "message": "Description" }',
        ']',
        '```',
        '',
        'After each lens JSON array, write a 2-3 sentence summary.',
        'If there are no findings for a lens, return an empty array `[]` and note the code looks good.',
      ].join('\n');

      pi.sendUserMessage(combinedPrompt, { deliverAs: 'followUp' });
    },
  });
}

/** Resolve which lens names to run based on explicit selection, defaults, or all available. */
function resolveLensNames(
  requested: string[],
  defaults: string[],
  available: Map<string, unknown>,
  warn: (msg: string) => void,
): string[] {
  if (requested.length > 0) {
    const missing = requested.filter((l) => !available.has(l));
    if (missing.length > 0) warn(`Unknown lenses: ${missing.join(', ')}`);
    return requested.filter((l) => available.has(l));
  }

  if (defaults.length > 0) {
    return defaults.filter((l) => available.has(l));
  }

  return [...available.keys()];
}
