import { extname } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// Markup / style file types worth scanning for design anti-patterns. Mirrors
// the engine's SCANNABLE_EXTENSIONS but kept local so default-target resolution
// has no dependency on the .mjs engine internals.
const SCANNABLE = new Set([
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.svelte',
  '.astro',
]);

const GIT_TIMEOUT_MS = 10_000;

async function git(pi: ExtensionAPI, args: string[], cwd: string): Promise<string> {
  try {
    const result = await pi.exec('git', args, { cwd, timeout: GIT_TIMEOUT_MS });
    return result.stdout ?? '';
  } catch {
    return '';
  }
}

/**
 * Working-directory markup/style files that changed vs HEAD, plus untracked
 * files — the most relevant scan target when the user runs detect without an
 * explicit path. Read-only; never touches the index. Returns absolute-ish paths
 * relative to cwd (git's own output), filtered to scannable extensions.
 */
export async function getChangedScannableFiles(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  const [tracked, untracked] = await Promise.all([
    git(pi, ['diff', '--name-only', 'HEAD'], cwd),
    git(pi, ['ls-files', '--others', '--exclude-standard'], cwd),
  ]);

  const files = new Set<string>();
  for (const line of `${tracked}\n${untracked}`.split('\n')) {
    const file = line.trim();
    if (file && SCANNABLE.has(extname(file).toLowerCase())) files.add(file);
  }
  return [...files];
}
