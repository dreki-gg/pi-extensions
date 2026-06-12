/**
 * Thin wrapper around the `stack` CLI (@kitlangton/stack).
 *
 * Runtime constraint: this file ships in the extension and runs on Node.js,
 * so it must not import Bun-specific modules. We accept an `exec` function
 * (provided by pi via `pi.exec`) instead of spawning directly, which also
 * keeps the module trivially testable.
 */

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
}

export type ExecFn = (command: string, args: string[]) => Promise<ExecResult>;

export const STACK_BIN = 'stack';

/** Run a `stack` subcommand and return the raw result. */
export async function runStack(exec: ExecFn, args: string[]): Promise<ExecResult> {
  return exec(STACK_BIN, args);
}

/** Throw-on-failure variant returning stdout. */
export async function runStackOrThrow(exec: ExecFn, args: string[]): Promise<string> {
  const result = await runStack(exec, args);
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
    throw new Error(`stack ${args.join(' ')} failed: ${detail}`);
  }
  return result.stdout;
}
