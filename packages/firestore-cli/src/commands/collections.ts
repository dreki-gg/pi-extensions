import { listCollections } from './ops-list.js';
import { withFirestore, printCliError, type GlobalOpts } from './run.js';
import { formatCollectionList } from '../output/format.js';
import { emitResult } from '../output/emit.js';

export async function collectionsCommand(
  path: string | undefined,
  opts: GlobalOpts,
): Promise<void> {
  try {
    await withFirestore(opts, async (db, auth) => {
      const collections = await listCollections(db, path);
      const digest = [
        formatCollectionList(collections),
        '',
        `Environment: ${auth.environment.name} (${auth.environment.projectId})`,
      ].join('\n');
      await emitResult(
        digest,
        {
          environment: auth.environment.name,
          projectId: auth.environment.projectId,
          parentPath: path ?? '(root)',
          collections,
        },
        'collections',
      );
    });
  } catch (err) {
    printCliError(err);
  }
}
