import { getDocument } from './ops-query.js';
import { withFirestore, printCliError, type GlobalOpts } from './run.js';
import { formatDocumentResult } from '../output/format.js';
import { emitResult } from '../output/emit.js';

export async function getCommand(docPath: string, opts: GlobalOpts): Promise<void> {
  try {
    await withFirestore(opts, async (db, auth) => {
      const doc = await getDocument(db, docPath);
      const subInfo =
        doc.subcollections.length > 0
          ? `\n\n**Subcollections:** ${doc.subcollections.map((s) => `\`${s.id}\``).join(', ')}`
          : '';
      const digest = [
        formatDocumentResult(doc) + subInfo,
        '',
        `Environment: ${auth.environment.name} (${auth.environment.projectId})`,
      ].join('\n');
      await emitResult(digest, { environment: auth.environment.name, ...doc }, 'document');
    });
  } catch (err) {
    printCliError(err);
  }
}
