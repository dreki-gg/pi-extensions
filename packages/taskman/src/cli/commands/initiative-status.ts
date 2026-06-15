/**
 * `taskman initiative-status [name]` — member plans + readiness rollup.
 */

import { initiativeRollup } from '../../initiative.js';
import { readPlansManifest } from '../../storage/plans-manifest.js';
import { readInitiativesManifest } from '../../storage/initiatives-manifest.js';
import { runPlanIO, CliError } from '../runtime.js';
import { emit } from '../format.js';

export async function initiativeStatusCommand(
  name: string | undefined,
  opts: { json?: boolean },
): Promise<void> {
  const initiatives = await runPlanIO(readInitiativesManifest());
  if (initiatives.length === 0) throw new CliError('No initiatives in .plans/initiatives.jsonl.');

  let target = name;
  if (!target) {
    const inProgress = initiatives.filter((i) => i.status === 'in-progress');
    if (inProgress.length === 1) target = inProgress[0]!.name;
    else {
      throw new CliError(
        `Pass an initiative name. Initiatives: ${initiatives.map((i) => i.name).join(', ')}.`,
      );
    }
  }

  const entry = initiatives.find((i) => i.name === target);
  if (!entry) {
    throw new CliError(
      `Initiative "${target}" not found. Available: ${initiatives.map((i) => i.name).join(', ')}.`,
    );
  }

  const plans = await runPlanIO(readPlansManifest());
  const rollup = initiativeRollup(entry.name, plans);

  const memberLines = rollup.members.map((m) => {
    const flag =
      m.status === 'in-progress'
        ? m.ready
          ? '  [ready]'
          : `  [blocked by ${m.blockedBy?.join(', ')}]`
        : '';
    return `  ${m.status === 'done' ? '✓' : '○'} ${m.name} [${m.status}] — ${m.title}${flag}`;
  });
  const human =
    `Initiative: ${entry.title} (${entry.name}) — ${entry.status}\n` +
    `Plans: ${rollup.done}/${rollup.total} done — in-progress ${rollup.inProgress} ` +
    `(ready ${rollup.ready}, blocked ${rollup.blocked})\n` +
    `Members:\n${memberLines.join('\n')}`;

  emit(Boolean(opts.json), { ...rollup, name: entry.name, status: entry.status }, human);
}
