import { buildRelationMap } from './relations-build.js';
import { withFirestore, printCliError, type GlobalOpts } from './run.js';
import { formatRelationMap } from '../output/format-relations.js';
import { emitResult } from '../output/emit.js';

const FALLBACK_SCAN = {
  maxSampleSize: 10,
  scanPaths: ['.'],
  scanExclude: ['node_modules', 'dist', '.git'],
};

export async function relationMapCommand(
  collection: string,
  opts: GlobalOpts,
): Promise<void> {
  try {
    await withFirestore(opts, async (db, auth) => {
      const scan = auth.config ?? FALLBACK_SCAN;
      const map = await buildRelationMap(db, process.cwd(), scan, [collection]);
      const digest = [
        formatRelationMap(map),
        '',
        `Environment: ${auth.environment.name} (${auth.environment.projectId})`,
      ].join('\n');
      await emitResult(digest, { environment: auth.environment.name, ...map }, 'relation-map');
    });
  } catch (err) {
    printCliError(err);
  }
}
