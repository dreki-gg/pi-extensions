import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { loadConfig, getLensDir } from '../config';
import { collectDiff, getChangedFiles } from '../diff';
import { discoverLenses, getLensContent } from '../lenses';
import { reviewWithLens } from '../reviewer';
import { buildReport } from '../report';
import type { LensResult, ReviewConfig, ReviewReport } from '../types';

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
      const config = loadConfig(cwd);
      const lensDir = getLensDir(cwd, config);
      const available = discoverLenses(lensDir);

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

        const lens = available.get(name)!;
        const content = getLensContent(lensDir, name) ?? '';
        const result = await reviewWithLens(pi, ctx, cwd, lens, content, diff, signal);
        results.push(result);
      }

      ctx.ui.setStatus('code-review', undefined);

      const report: ReviewReport = {
        diff: diff.diff,
        diffStat: diff.stat,
        lenses: results,
        generatedAt: new Date().toISOString().slice(0, 10),
      };

      const markdown = buildReport(report);
      const toolContext = buildToolContext(results);

      return {
        content: [{ type: 'text', text: markdown + toolContext }],
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

function buildToolContext(results: LensResult[]): string {
  const prompts = results.map((r) => r._prompt).filter(Boolean);

  if (prompts.length === 0) return '';

  return [
    '',
    '---',
    '',
    'The tool outputs above provide automated analysis. Now evaluate the diff through each lens criteria:',
    '',
    ...prompts,
  ].join('\n');
}
