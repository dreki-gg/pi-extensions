import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export type DiffSource = {
  diff: string;
  stat: string;
  label: string;
};

/** Collect the diff from the working directory or a specific base ref. */
export async function collectDiff(
  pi: ExtensionAPI,
  cwd: string,
  options: { base?: string; staged?: boolean },
): Promise<DiffSource> {
  if (options.staged) {
    const diff = await pi.exec('git', ['diff', '--staged'], { cwd });
    const stat = await pi.exec('git', ['diff', '--staged', '--stat'], { cwd });
    return {
      diff: diff.stdout,
      stat: stat.stdout,
      label: 'staged changes',
    };
  }

  if (options.base) {
    const diff = await pi.exec('git', ['diff', options.base], { cwd });
    const stat = await pi.exec('git', ['diff', options.base, '--stat'], { cwd });
    return {
      diff: diff.stdout,
      stat: stat.stdout,
      label: `changes since ${options.base}`,
    };
  }

  // Default: working directory changes (unstaged + staged)
  const diff = await pi.exec('git', ['diff', 'HEAD'], { cwd });
  const stat = await pi.exec('git', ['diff', 'HEAD', '--stat'], { cwd });

  // If no HEAD diff, fall back to just working directory
  if (!diff.stdout.trim()) {
    const wdDiff = await pi.exec('git', ['diff'], { cwd });
    const wdStat = await pi.exec('git', ['diff', '--stat'], { cwd });
    return {
      diff: wdDiff.stdout,
      stat: wdStat.stdout,
      label: 'working directory changes',
    };
  }

  return {
    diff: diff.stdout,
    stat: stat.stdout,
    label: 'all uncommitted changes',
  };
}

/** Get a list of changed file paths from the diff. */
export async function getChangedFiles(
  pi: ExtensionAPI,
  cwd: string,
  options: { base?: string; staged?: boolean },
): Promise<string[]> {
  const args = ['diff', '--name-only'];

  if (options.staged) {
    args.push('--staged');
  } else if (options.base) {
    args.push(options.base);
  } else {
    args.push('HEAD');
  }

  const result = await pi.exec('git', args, { cwd });
  return result.stdout
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}
