import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { collectionsCommand } from './commands/collections.js';
import { queryCommand } from './commands/query.js';
import { getCommand } from './commands/get.js';
import { countCommand } from './commands/count.js';
import { relationMapCommand } from './commands/relation-map.js';

function packageVersion(): string {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function envOption(cmd: Command): Command {
  return cmd.option('--env <name>', 'Firestore environment from config');
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('firestore-cli')
    .description('Standalone Firestore CLI (collections, query, get, count, relation-map)')
    .version(packageVersion());

  envOption(
    program
      .command('collections')
      .description('List root collections, or subcollections of a document path')
      .argument('[path]', 'document path whose subcollections to list'),
  ).action(async (path: string | undefined, opts: { env?: string }) => {
    await collectionsCommand(path, { env: opts.env });
  });

  envOption(
    program
      .command('query')
      .description('Query documents with optional where/order/limit')
      .argument('<collection>', 'collection path')
      .option('--where <field,op,value>', 'filter clause (repeatable)', collect, [])
      .option('--order-by <field[,dir]>', 'order by field, optional asc|desc')
      .option('--limit <n>', 'max documents (1-100, default 25)')
      .option('--start-after <id>', 'pagination cursor document id'),
  ).action(async (collection: string, opts) => {
    await queryCommand(collection, opts);
  });

  envOption(
    program
      .command('get')
      .description('Fetch a single document by full path')
      .argument('<docPath>', 'document path (e.g. users/abc123)'),
  ).action(async (docPath: string, opts: { env?: string }) => {
    await getCommand(docPath, { env: opts.env });
  });

  envOption(
    program
      .command('count')
      .description('Count documents in a collection with optional filters')
      .argument('<collection>', 'collection path')
      .option('--where <field,op,value>', 'filter clause (repeatable)', collect, []),
  ).action(async (collection: string, opts) => {
    await countCommand(collection, opts);
  });

  envOption(
    program
      .command('relation-map')
      .description('Map relations for a collection via local source scan + field analysis')
      .argument('<collection>', 'collection to analyze'),
  ).action(async (collection: string, opts: { env?: string }) => {
    await relationMapCommand(collection, { env: opts.env });
  });

  return program;
}
