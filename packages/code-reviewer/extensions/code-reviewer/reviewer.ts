import { platform } from 'node:os';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { DiffSource } from './diff';
import type { LensConfig, LensResult } from './types';

const isWindows = platform() === 'win32';

/** Run project tools specified by a lens and collect their output. */
async function runLensTools(
  pi: ExtensionAPI,
  cwd: string,
  tools: string[],
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const outputs: Record<string, string> = {};

  for (const tool of tools) {
    if (signal?.aborted) break;

    try {
      const [shell, shellArgs] = isWindows ? ['cmd', ['/c', tool]] : ['sh', ['-c', tool]];
      const result = await pi.exec(shell, shellArgs, {
        cwd,
        timeout: 60_000,
        signal,
      });
      outputs[tool] = result.stdout || result.stderr || '(no output)';
    } catch {
      outputs[tool] = `(tool failed or timed out: ${tool})`;
    }
  }

  return outputs;
}

/** Build the shared diff section of the review prompt (included once). */
export function buildDiffSection(diff: DiffSource): string {
  const parts: string[] = [];
  const maxDiffLen = 50_000;
  const diffTruncated = diff.diff.length > maxDiffLen;

  parts.push(`## Diff (${diff.label})`);
  parts.push('```diff');
  parts.push(diff.diff.slice(0, maxDiffLen));
  parts.push('```');
  if (diffTruncated) {
    parts.push(
      `> ⚠️ Diff truncated (${diff.diff.length} chars → ${maxDiffLen}). Some files may not appear above.`,
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
function buildLensSection(
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

/** Build the full review prompt for a single lens (includes diff — used by the tool path). */
function buildReviewPrompt(
  lens: LensConfig,
  lensContent: string,
  diff: DiffSource,
  toolOutputs: Record<string, string>,
): string {
  const parts: string[] = [];

  parts.push(`You are reviewing code changes through the "${lens.name}" lens.`);
  parts.push('');
  parts.push(buildDiffSection(diff));
  parts.push('');
  parts.push(buildLensSection(lens, lensContent, toolOutputs));
  parts.push('');
  parts.push('## Instructions');
  parts.push('');
  parts.push('Review the diff above through this lens. For each finding, output a JSON array:');
  parts.push('');
  parts.push('```json');
  parts.push('[');
  parts.push(
    '  { "file": "path/to/file.ts", "line": 42, "severity": "warning", "message": "Description" }',
  );
  parts.push(']');
  parts.push('```');
  parts.push('');
  parts.push(
    'After the JSON array, write a 2-3 sentence summary of your review through this lens.',
  );
  parts.push('If there are no findings, return an empty array `[]` and note the code looks good.');

  return parts.join('\n');
}

/** Execute a review for a single lens using the subagent tool. */
export async function reviewWithLens(
  pi: ExtensionAPI,
  _ctx: unknown,
  cwd: string,
  lens: LensConfig,
  lensContent: string,
  diff: DiffSource,
  signal?: AbortSignal,
): Promise<LensResult> {
  // Run lens tools first
  const toolOutputs = await runLensTools(pi, cwd, lens.tools, signal);

  // Build the prompt
  const prompt = buildReviewPrompt(lens, lensContent, diff, toolOutputs);
  const lensSection = buildLensSection(lens, lensContent, toolOutputs);

  return {
    lens: lens.name,
    findings: [],
    summary: '',
    toolOutputs,
    _prompt: prompt,
    _lensSection: lensSection,
  };
}
