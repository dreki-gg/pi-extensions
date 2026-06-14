/**
 * Read-only git helpers. Failure-tolerant by design: plan-mode must never block
 * or throw because git metadata is unavailable (no repo, detached HEAD, no
 * commits yet). Runs on Node via execFile — no Bun APIs.
 */

import { execFile } from 'node:child_process';

/**
 * Resolve the current HEAD commit SHA, or undefined when it cannot be read.
 * Never rejects — callers treat undefined as "no drift baseline".
 */
export function readHeadCommit(cwd: string = process.cwd()): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd }, (error, stdout) => {
      if (error) return resolve(undefined);
      const sha = stdout.trim();
      resolve(sha.length > 0 ? sha : undefined);
    });
  });
}
