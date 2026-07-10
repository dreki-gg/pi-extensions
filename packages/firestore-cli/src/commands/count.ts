import { countDocuments } from './ops-query.js';
import { parseWhereFlags } from './where.js';
import { withFirestore, printCliError, type GlobalOpts } from './run.js';
import { formatCountResult } from '../output/format.js';
import { emitResult } from '../output/emit.js';

export interface CountOpts extends GlobalOpts {
  where?: string[];
}

export async function countCommand(collection: string, opts: CountOpts): Promise<void> {
  try {
    const where = parseWhereFlags(opts.where);
    await withFirestore(opts, async (db, auth) => {
      const count = await countDocuments(db, collection, where);
      const digest = [
        formatCountResult(collection, count, where),
        '',
        `Environment: ${auth.environment.name} (${auth.environment.projectId})`,
      ].join('\n');
      await emitResult(
        digest,
        {
          environment: auth.environment.name,
          projectId: auth.environment.projectId,
          collection,
          count,
          where: where ?? [],
        },
        'count',
      );
    });
  } catch (err) {
    printCliError(err);
  }
}
