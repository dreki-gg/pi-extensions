/**
 * preview_prototype tool — available during the plan phase.
 *
 * Renders a Pug prototype to a standalone HTML visual aid, writes it under
 * .plans/_prototypes/, and best-effort opens it so the user can react to the
 * visual BEFORE the plan is finalized.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { Effect } from 'effect';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { FileSystem } from '../effects/filesystem.js';
import type { RunPlanIO } from '../effects/runtime.js';
import { renderPrototypeHtml } from '../html/render.js';
import { toKebabCase } from '../utils.js';

const PREVIEW_DIR = '.plans/_prototypes';

/** Best-effort open of a file in the OS default app. Never throws. */
function openInBrowser(filePath: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = spawn(command, [filePath], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Opening is a convenience — ignore failures (headless, sandbox, etc.).
  }
}

export function registerPreviewPrototypeTool(pi: ExtensionAPI, runPlanIO: RunPlanIO): void {
  pi.registerTool({
    name: 'preview_prototype',
    label: 'Preview Prototype',
    description:
      'Render a Pug prototype to a standalone HTML visual aid and open it for review during planning.',
    promptSnippet: 'Render a Pug UI prototype to HTML and open it for the user to review',
    promptGuidelines: [
      'Use preview_prototype during planning for visual/UI/layout/style work, before submit_plan.',
      'The prototype is a convergence aid — show it so the user can react before the plan hardens.',
      'Keep the Pug self-contained; inline any styles the prototype needs.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Short title for the prototype' }),
      intent: Type.String({
        description: 'One-line description of what this prototype is showing',
      }),
      pug: Type.String({ description: 'Pug markup for the prototype body' }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const slug = toKebabCase(params.title) || 'prototype';
      const filePath = join(PREVIEW_DIR, `${slug}.html`);
      const html = renderPrototypeHtml(params.title, params.intent, params.pug);

      await runPlanIO(
        Effect.gen(function* () {
          const fs = yield* FileSystem;
          yield* fs.makeDir(PREVIEW_DIR);
          yield* fs.writeFileString(filePath, html);
        }),
      );
      openInBrowser(filePath);
      ctx?.ui?.notify(`Prototype written to ${filePath} — opening for review.`, 'info');

      return {
        content: [
          {
            type: 'text' as const,
            text: `Prototype "${params.title}" rendered to ${filePath} and opened. Ask the user for feedback before submitting the plan.`,
          },
        ],
        details: { filePath, title: params.title },
      };
    },

    renderCall(args, theme) {
      const title = (args as { title?: string }).title ?? 'prototype';
      let content = theme.fg('toolTitle', theme.bold('preview_prototype '));
      content += theme.fg('accent', title);
      return new Text(content, 0, 0);
    },

    renderResult(result, _options, theme) {
      const filePath = (result.details as { filePath?: string } | undefined)?.filePath;
      const label = filePath ? `✓ Prototype → ${filePath}` : '✓ Prototype rendered';
      return new Text(theme.fg('success', label), 0, 0);
    },
  });
}
