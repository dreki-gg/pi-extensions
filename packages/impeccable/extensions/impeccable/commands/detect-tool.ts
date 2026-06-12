import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { getChangedScannableFiles } from '../changed-files';
import { detectTargets, formatFindings, type DetectFinding } from '../detect';

// pi caps tool output at ~50KB; spill anything larger to a temp file the agent
// can page through with `read`, returning a compact summary inline.
const MAX_INLINE_BYTES = 40_000;

function summarize(findings: DetectFinding[]): string {
  const byRule = new Map<string, number>();
  for (const f of findings) byRule.set(f.antipattern, (byRule.get(f.antipattern) ?? 0) + 1);
  const top = [...byRule.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, n]) => `${id} (${n})`)
    .join(', ');
  const files = new Set(findings.map((f) => f.file)).size;
  return `${findings.length} anti-pattern(s) across ${files} file(s). Top: ${top}.`;
}

export function registerDetectTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'impeccable_detect',
    label: 'Impeccable Detect',
    description:
      "Run impeccable's deterministic design anti-pattern rules over source files (HTML/CSS/JSX/TSX). No browser or API key. Defaults to changed files when no targets are given.",
    promptSnippet: 'Scan source files for deterministic design anti-patterns (impeccable)',
    promptGuidelines: [
      'Use impeccable_detect to find design slop (side-stripe borders, gradient text, overused fonts, cramped tracking, low-contrast text, etc.) in markup and styles.',
      'Omit targets to scan the working-directory changes; pass file or directory paths to scope it.',
      'For rendered-page / URL checks, capture the page with pi web_* tools and pass the saved HTML path here.',
    ],
    parameters: Type.Object({
      targets: Type.Optional(
        Type.Array(Type.String(), {
          description:
            'Files or directories to scan. Defaults to changed markup/style files when omitted.',
        }),
      ),
      providers: Type.Optional(
        Type.Array(Type.Union([Type.Literal('gpt'), Type.Literal('gemini')]), {
          description:
            'Also report provider-specific tells (e.g. "gemini" image-hover, "gpt"). Off by default.',
        }),
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd;
      let targets = params.targets ?? [];

      if (targets.length === 0) {
        ctx.ui.setStatus('impeccable', '🔎 Resolving changed files...');
        targets = await getChangedScannableFiles(pi, cwd);
        if (targets.length === 0) {
          ctx.ui.setStatus('impeccable', undefined);
          return {
            content: [
              {
                type: 'text',
                text: 'No changed markup/style files to scan. Pass explicit targets (files or directories) to scan a wider scope.',
              },
            ],
            details: { findings: 0 },
          };
        }
      }

      ctx.ui.setStatus('impeccable', `🔎 Scanning ${targets.length} target(s)...`);
      const findings = await detectTargets(targets, { providers: params.providers });
      ctx.ui.setStatus('impeccable', undefined);

      if (findings.length === 0) {
        return {
          content: [{ type: 'text', text: 'No design anti-patterns found.' }],
          details: { findings: 0 },
        };
      }

      const report = formatFindings(findings);
      const details = { findings: findings.length, summary: summarize(findings) };

      if (Buffer.byteLength(report, 'utf8') <= MAX_INLINE_BYTES) {
        return { content: [{ type: 'text', text: report }], details };
      }

      // Spill the full report; survives compaction and pi's output cap.
      const path = join(tmpdir(), `impeccable-detect-${Date.now()}.txt`);
      try {
        await writeFile(path, report, 'utf8');
        return {
          content: [
            {
              type: 'text',
              text: `${summarize(findings)}\n\nFull report (read to page through): ${path}`,
            },
          ],
          details: { ...details, reportPath: path },
        };
      } catch {
        // Write failed — return a truncated inline report rather than nothing.
        return {
          content: [{ type: 'text', text: `${report.slice(0, MAX_INLINE_BYTES)}\n…(truncated)` }],
          details,
        };
      }
    },
  });
}
