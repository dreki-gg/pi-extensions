/**
 * preview_prototype tool — available during the plan phase.
 *
 * Persists a freeform HTML prototype the agent authored (no template engine,
 * no imposed theme), writes it under .plans/_prototypes/, and best-effort opens
 * it so the user can react to the visual BEFORE the plan is finalized.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { Effect } from 'effect';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { FileSystem } from '@dreki-gg/taskman';
import type { RunPlanIO } from '@dreki-gg/taskman';
import { buildPrototypeDocument } from '../html/render.js';
import { toKebabCase } from '@dreki-gg/taskman';

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
      'Open a freeform HTML prototype for review during planning. You write the HTML — any markup, styles, fonts, and scripts you want — and the tool just persists and opens it.',
    promptSnippet: 'Open a freeform HTML prototype for the user to review',
    promptGuidelines: [
      'Use preview_prototype during planning for visual/UI/layout/style work, before submit_plan.',
      'The prototype is a convergence aid — show it so the user can react before the plan hardens.',
      'You have full freedom over the HTML: there is no template engine and no imposed theme. Avoid generic boilerplate — design something that fits the actual product.',
      'For real design taste, consider delegating the markup to the ux-designer subagent and passing its HTML straight through.',
      'Pass a complete, self-contained HTML document (doctype + html/head/body). Inline any styles or scripts; assume nothing about a host page.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Short title for the prototype' }),
      intent: Type.String({
        description: 'One-line description of what this prototype is showing',
      }),
      html: Type.String({
        description:
          'Complete, self-contained HTML document for the prototype (your own markup, styles, and scripts). A bare fragment is also accepted and wrapped in a minimal unstyled shell.',
      }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const slug = toKebabCase(params.title) || 'prototype';
      const filePath = join(PREVIEW_DIR, `${slug}.html`);
      const html = buildPrototypeDocument(params.title, params.html);

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
