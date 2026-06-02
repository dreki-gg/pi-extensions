import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { loadConfig, getLensDir } from '../config';
import { collectDiff, getChangedFiles } from '../diff';
import { discoverLenses, getLensContent } from '../lenses';
import { buildDiffSection, buildLensResult, pickLensToolOutputs, runTools } from '../reviewer';
import type { DiffSource } from '../diff';
import type { LensResult, ReviewConfig } from '../types';

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
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const cwd = ctx.cwd;
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

      ctx.ui.setStatus('code-review', undefined);

      // The tool returns a pre-review skeleton + the review task. Findings are
      // produced by the agent in its follow-up message (per the instructions
      // below), NOT parsed back here — so we deliberately do not render a
      // findings scoreboard that would always read "0".
      const text = buildToolContext(results, diff);

      return {
        content: [{ type: 'text', text }],
        details: {
          lensCount: lensNames.length,
          availableLenses: [...available.keys()],
          changedFiles: await getChangedFiles(pi, cwd, {
            base: params.base,
            staged: params.staged,
          }),
        },
      };
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

/**
 * Build the agent-facing review instructions appended to the report. The diff
 * is embedded ONCE (not per lens) followed by each lens's section — large
 * diffs would otherwise be repeated for every lens, bloating the tool output.
 */
function buildToolContext(results: LensResult[], diff: DiffSource): string {
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
