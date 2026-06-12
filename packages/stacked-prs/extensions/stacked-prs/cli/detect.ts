/**
 * Detect whether the GitHub toolchain is available and authenticated.
 *
 * The engine is fully self-contained — it shells out only to `git` and `gh`,
 * both of which are normally already present. We just verify `gh` is
 * authenticated; `git` is assumed available inside a repo.
 */
import type { ExecFn } from './runner';

export interface DetectResult {
  /** `gh` CLI is installed and authenticated. */
  ready: boolean;
  /** Human-readable guidance when something is missing. */
  message?: string;
}

/** Probe `gh auth status`. */
export async function detectGitHub(exec: ExecFn): Promise<DetectResult> {
  const authed = await isRunnable(exec, 'gh', ['auth', 'status']);
  if (authed) return { ready: true };
  return {
    ready: false,
    message:
      'GitHub CLI is not available or not authenticated. Install https://cli.github.com/ and run `gh auth login`.',
  };
}

async function isRunnable(exec: ExecFn, command: string, args: string[]): Promise<boolean> {
  try {
    const result = await exec(command, args);
    return result.code === 0;
  } catch {
    return false;
  }
}
