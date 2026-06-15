/**
 * Shared CLI plumbing: a single `runPlanIO` bridge plus stateless plan
 * resolution that exits with a clear message when no single plan can be picked.
 */

import { makePlanRuntime, type RunPlanIO } from '../effects/runtime.js';
import { resolvePlanByName } from '../resolve.js';

export const runPlanIO: RunPlanIO = makePlanRuntime();

export class CliError extends Error {}

/**
 * Resolve a target plan directory from an optional `--plan` hint, else the sole
 * in-progress plan. Throws `CliError` (caught at the top level → exit 1) with
 * the in-progress candidates when resolution is ambiguous or misses.
 */
export async function resolvePlanDir(
  name?: string,
): Promise<{ planName: string; planDir: string }> {
  const { planName, planDir, candidates } = await runPlanIO(resolvePlanByName({ name }));
  if (planName && planDir) return { planName, planDir };

  if (name) {
    throw new CliError(
      `Plan "${name}" not found. In-progress plans: ${candidates.join(', ') || '(none)'}.`,
    );
  }
  if (candidates.length > 1) {
    throw new CliError(
      `Multiple in-progress plans — pass --plan <name>. Candidates: ${candidates.join(', ')}.`,
    );
  }
  throw new CliError('No in-progress plan found in .plans/plans.jsonl. Pass --plan <name>.');
}
