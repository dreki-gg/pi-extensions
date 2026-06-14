/**
 * Exec adapter types shared across the engine.
 *
 * Runtime constraint: this ships in the extension and runs on Node.js, so it
 * must not import Bun-specific modules. The engine takes an injected `ExecFn`
 * (provided by pi via `pi.exec`) instead of spawning directly, which keeps
 * every module trivially testable.
 */

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
}

export type ExecFn = (command: string, args: string[]) => Promise<ExecResult>;

/** Per-`gh`-call timeout. Bounds a single hung invocation so a stalled network
 * call cannot freeze a poll loop indefinitely. */
export const GH_CALL_TIMEOUT_MS = 30_000;
