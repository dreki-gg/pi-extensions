/**
 * `taskman create-handoff [content]` — write/replace HANDOFF.md for a plan.
 *
 * Lets a foreign harness hand off markdown without going through the plan-mode
 * extension: content comes from an inline argument, `--file <path>`, or stdin.
 */

import { saveHandoff } from '../../storage/plan-storage.js';
import { runPlanIO, resolvePlanDir } from '../runtime.js';
import { resolveContent } from '../input.js';
import { emit } from '../format.js';

export async function createHandoffCommand(
  content: string | undefined,
  opts: { plan?: string; file?: string; json?: boolean },
): Promise<void> {
  const { planName, planDir } = await resolvePlanDir(opts.plan);
  const markdown = await resolveContent(content, opts.file, 'handoff');
  await runPlanIO(saveHandoff(planDir, markdown));

  emit(
    Boolean(opts.json),
    { plan_name: planName, path: `${planDir}/HANDOFF.md`, bytes: Buffer.byteLength(markdown) },
    `Wrote HANDOFF.md (${Buffer.byteLength(markdown)} bytes) for ${planName}.`,
  );
}
