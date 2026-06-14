import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerBabysitterCommand, restoreSeenState } from './command';

export default function prBabysitterExtension(pi: ExtensionAPI) {
  const babysitter = registerBabysitterCommand(pi);

  // Re-seed seen-state after reload/resume so previously seen checks/comments
  // never re-fire when the human restarts the watch.
  pi.on('session_start', async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries() as ReadonlyArray<{
      type?: string;
      customType?: string;
      data?: unknown;
    }>;
    const seen = restoreSeenState(entries);
    if (seen) babysitter.restore(seen);
  });

  // Never leave an orphan polling timer behind.
  pi.on('session_shutdown', async () => {
    babysitter.stop();
  });
}
