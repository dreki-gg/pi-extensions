/**
 * Detect whether the stacking toolchain is available and authenticated.
 */
import type { ExecFn } from './runner';

export interface DetectResult {
  /** `stack` CLI is installed and runnable. */
  stackInstalled: boolean;
  /** A host CLI (`gh` or `glab`) is authenticated. */
  hostAuthenticated: boolean;
  /** Which host CLI was detected as authenticated, if any. */
  host?: 'github' | 'gitlab';
  /** Human-readable guidance when something is missing. */
  message?: string;
}

const INSTALL_HINT =
  'Install it with `npm install -g @kitlangton/stack`, then authenticate a host CLI (`gh auth login` or `glab auth login`).';

/** Probe `stack`, `gh`, and `glab` availability. */
export async function detectStack(exec: ExecFn): Promise<DetectResult> {
  const stackInstalled = await isRunnable(exec, 'stack', ['--version']);
  if (!stackInstalled) {
    return {
      stackInstalled: false,
      hostAuthenticated: false,
      message: `The \`stack\` CLI was not found. ${INSTALL_HINT}`,
    };
  }

  const ghAuthed = await isRunnable(exec, 'gh', ['auth', 'status']);
  if (ghAuthed) {
    return { stackInstalled: true, hostAuthenticated: true, host: 'github' };
  }

  const glabAuthed = await isRunnable(exec, 'glab', ['auth', 'status']);
  if (glabAuthed) {
    return { stackInstalled: true, hostAuthenticated: true, host: 'gitlab' };
  }

  return {
    stackInstalled: true,
    hostAuthenticated: false,
    message:
      'No authenticated host CLI found. Run `gh auth login` (GitHub) or `glab auth login` (GitLab).',
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
