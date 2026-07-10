import { queryDocuments } from './ops-query.js';
import { parseOrderByFlag, parseWhereFlags } from './where.js';
import { withFirestore, printCliError, type GlobalOpts } from './run.js';
import { formatQueryResult } from '../output/format.js';
import { emitResult } from '../output/emit.js';

export interface QueryOpts extends GlobalOpts {
  where?: string[];
  orderBy?: string;
  limit?: string;
  startAfter?: string;
}

export async function queryCommand(collection: string, opts: QueryOpts): Promise<void> {
  try {
    const where = parseWhereFlags(opts.where);
    const orderBy = parseOrderByFlag(opts.orderBy);
    const limit = opts.limit !== undefined ? Number(opts.limit) : undefined;
    if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
      throw new Error('--limit must be a positive number');
    }

    await withFirestore(opts, async (db, auth) => {
      const result = await queryDocuments(db, {
        collection,
        where,
        orderBy,
        limit,
        startAfter: opts.startAfter,
      });
      const digest = [
        formatQueryResult(result),
        '',
        `Environment: ${auth.environment.name} (${auth.environment.projectId})`,
      ].join('\n');
      await emitResult(digest, { environment: auth.environment.name, ...result }, 'query');
    });
  } catch (err) {
    printCliError(err);
  }
}
