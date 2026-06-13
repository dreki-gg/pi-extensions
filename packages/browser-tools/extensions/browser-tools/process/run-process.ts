import { spawn } from 'node:child_process';

export type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type RunProcessOptions = {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
  /** Hard upper bound; the process is killed and the promise rejects on expiry. */
  timeoutMs?: number;
  /** Injectable for tests. */
  spawnFn?: typeof spawn;
};

export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Spawn a process, collect its output, and resolve when it exits.
 *
 * Two robustness properties matter here, both motivated by the agent-browser
 * CLI on Windows:
 *
 * 1. **Settle on `'exit'`, not `'close'`.** agent-browser is session-based: a
 *    command like `open` or `screenshot` spawns a persistent browser daemon.
 *    On Windows that daemon inherits the parent's stdout/stderr handles by
 *    default and keeps them open, so the `'close'` event (which waits for every
 *    stdio stream to end) never fires and the caller hangs forever. `'exit'`
 *    fires when the CLI process itself terminates, regardless of inherited
 *    pipes, so we resolve from there and stop referencing the dangling streams.
 *
 * 2. **A hard timeout.** If the CLI genuinely wedges, a bounded timeout turns an
 *    infinite hang into a clear, actionable error instead of freezing the agent.
 */
export function runProcess(options: RunProcessOptions): Promise<ProcessResult> {
  const spawnImpl = options.spawnFn ?? spawn;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<ProcessResult>((resolve, reject) => {
    const child = spawnImpl(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: options.shell ?? process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let exitCode: number | null = null;

    const timer = setTimeout(() => {
      if (settled) return;
      try {
        child.kill();
      } catch {
        // best effort
      }
      finish(() =>
        reject(
          new Error(
            `Process timed out after ${timeoutMs}ms: ${options.command} ${options.args.join(' ')}`,
          ),
        ),
      );
    }, timeoutMs);
    // Don't let the timeout timer keep the event loop alive on its own.
    timer.unref?.();

    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout?.destroy();
      child.stderr?.destroy();
      action();
    }

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      finish(() => reject(error));
    });

    // Resolve once the process has exited. Defer one tick so any final buffered
    // `'data'` events flush before we tear the streams down.
    const onExit = (code: number | null): void => {
      exitCode = code;
      setImmediate(() => {
        finish(() => resolve({ stdout, stderr, exitCode: exitCode ?? 1 }));
      });
    };
    child.on('exit', onExit);
    child.on('close', onExit);
  });
}
