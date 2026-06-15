/**
 * `taskman` CLI — drive the `.plans/` task ledger from any Node harness.
 *
 * Thin Commander wiring over the engine: each subcommand delegates to an action
 * module under `cli/commands/`. Human text by default; `--json` for machines.
 */

import { Command } from 'commander';
import { CliError } from './cli/runtime.js';
import { statusCommand } from './cli/commands/status.js';
import { listPlansCommand, listInitiativesCommand } from './cli/commands/list.js';
import { initiativeStatusCommand } from './cli/commands/initiative-status.js';
import { updateTaskCommand } from './cli/commands/update-task.js';
import { addTaskCommand } from './cli/commands/add-task.js';
import { reconcileCommand } from './cli/commands/reconcile.js';
import { closePlanCommand, closeInitiativeCommand } from './cli/commands/close.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('taskman')
    .description('Task-management engine over a .plans/ JSONL ledger')
    .version('0.1.0');

  program
    .command('status')
    .description('Progress + task ids/statuses for the active plan')
    .option('--plan <name>', 'plan name (or .plans/<name>) to inspect')
    .option('--json', 'machine-readable JSON output')
    .action((opts) => statusCommand(opts));

  program
    .command('list')
    .description('List plans')
    .option('--status <status>', 'all|in-progress|done|superseded|abandoned')
    .option('--sort <field>', 'name|date-asc|date-desc|tasks')
    .option('--json', 'machine-readable JSON output')
    .action((opts) => listPlansCommand(opts));

  program
    .command('initiatives')
    .description('List initiatives')
    .option('--status <status>', 'all|in-progress|done|superseded|abandoned')
    .option('--json', 'machine-readable JSON output')
    .action((opts) => listInitiativesCommand(opts));

  program
    .command('initiative-status')
    .description('Member plans + readiness for an initiative')
    .argument('[name]', 'initiative name (defaults to the sole in-progress one)')
    .option('--json', 'machine-readable JSON output')
    .action((name, opts) => initiativeStatusCommand(name, opts));

  program
    .command('update-task')
    .description('Set a task status (done|skipped|blocked|pending)')
    .argument('<id>', 'task id, e.g. t-001')
    .argument('<status>', 'done|skipped|blocked|pending')
    .option('--plan <name>', 'plan to target')
    .option('--notes <text>', 'notes recorded on the task')
    .option('--json', 'machine-readable JSON output')
    .action((id, status, opts) => updateTaskCommand(id, status, opts));

  program
    .command('add-task')
    .description('Append a deferred follow-up task')
    .argument('<description>', 'short task label')
    .requiredOption('--reason <text>', 'why this follow-up matters')
    .option('--plan <name>', 'plan to target')
    .option('--details <text>', 'fuller implementation notes')
    .option('--json', 'machine-readable JSON output')
    .action((description, opts) => addTaskCommand(description, opts));

  program
    .command('reconcile')
    .description('Detect (and with --apply, repair) status drift')
    .option('--apply', 'repair safe in-progress→done drift')
    .option('--json', 'machine-readable JSON output')
    .action((opts) => reconcileCommand(opts));

  program
    .command('close')
    .description('Set a plan lifecycle status')
    .argument('<status>', 'done|superseded|abandoned|in-progress')
    .option('--plan <name>', 'plan to target')
    .option('--reason <text>', 'why (recorded in the registry)')
    .option('--json', 'machine-readable JSON output')
    .action((status, opts) => closePlanCommand(status, opts));

  program
    .command('close-initiative')
    .description('Set an initiative lifecycle status')
    .argument('<status>', 'done|superseded|abandoned|in-progress')
    .argument('<name>', 'initiative name')
    .option('--reason <text>', 'why (recorded in the registry)')
    .option('--json', 'machine-readable JSON output')
    .action((status, name, opts) => closeInitiativeCommand(status, name, opts));

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  try {
    await buildProgram().parseAsync(argv);
  } catch (err) {
    const message =
      err instanceof CliError ? err.message : err instanceof Error ? err.message : String(err);
    process.stderr.write(`taskman: ${message}\n`);
    process.exitCode = 1;
  }
}

main();
