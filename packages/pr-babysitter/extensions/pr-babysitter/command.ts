import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import { GH_CALL_TIMEOUT_MS, type ExecFn, type ExecResult } from './cli/runner';
import { Babysitter } from './watcher/poller';
import type { SeenState } from './watcher/state';
import { getBabysitCompletions } from './completions';

const STATUS_KEY = 'pr-babysitter';
const USAGE = 'Usage: /babysit start | stop | status';

/**
 * Register the human-only `/babysit` command and return the shared Babysitter
 * instance so the extension entrypoint can drive its session lifecycle.
 */
export function registerBabysitterCommand(pi: ExtensionAPI): Babysitter {
  const exec: ExecFn = (command, args) =>
    pi.exec(command, args, { timeout: GH_CALL_TIMEOUT_MS }) as Promise<ExecResult>;

  // ctx.ui is captured per command call into this holder so the polling timer
  // (which runs outside any handler) can still surface status/notifications.
  let ui: ExtensionCommandContext['ui'] | undefined;

  const babysitter = new Babysitter({
    exec,
    wake: (text) => pi.sendUserMessage(text, { deliverAs: 'followUp' }),
    persist: (state) => pi.appendEntry('babysit-seen', state),
    notify: (text, level) => ui?.notify(text, level),
    setStatus: (text) => ui?.setStatus(STATUS_KEY, text),
  });

  pi.registerCommand('babysit', {
    description: `Babysit the current branch's PR (observe-only). ${USAGE}`,
    getArgumentCompletions: (argumentPrefix) => getBabysitCompletions(argumentPrefix),
    handler: async (args, ctx) => {
      ui = ctx.ui;
      const sub = (args?.trim() || '').split(/\s+/)[0] || '';
      switch (sub) {
        case 'start': {
          ctx.ui.setStatus(STATUS_KEY, '🔍 Resolving current PR...');
          const result = await babysitter.start();
          if (!result.ok) ctx.ui.setStatus(STATUS_KEY, undefined);
          ctx.ui.notify(result.message, result.ok ? 'info' : 'warning');
          return;
        }
        case 'stop':
          babysitter.stop();
          ctx.ui.notify('Stopped babysitting.', 'info');
          return;
        case 'status':
          ctx.ui.notify(babysitter.status(), 'info');
          return;
        default:
          ctx.ui.notify(USAGE, 'warning');
      }
    },
  });

  return babysitter;
}

/** Latest persisted seen-state from the session, if any. */
export function restoreSeenState(
  entries: ReadonlyArray<{ type?: string; customType?: string; data?: unknown }>,
): SeenState | undefined {
  let latest: SeenState | undefined;
  for (const entry of entries) {
    if (entry.type === 'custom' && entry.customType === 'babysit-seen' && entry.data) {
      latest = entry.data as SeenState;
    }
  }
  return latest;
}
