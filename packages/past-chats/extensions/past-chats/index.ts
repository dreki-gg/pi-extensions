import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerAutocomplete } from './autocomplete';
import { registerCommands } from './commands';
import { loadConfig, resolveFolders } from './config';
import { registerContextInjection } from './context';
import { createPastChatIndex } from './indexer';
import { registerSearchTool } from './tool';
import type { PastChatsConfig, PastChatsRuntimeState } from './types';

export default function pastChatsExtension(pi: ExtensionAPI): void {
  const state: PastChatsRuntimeState = {
    cwd: '',
    config: { folders: [] } satisfies PastChatsConfig,
    folders: [],
    index: createPastChatIndex(),
  };

  const reload = async (cwd = state.cwd): Promise<void> => {
    state.cwd = cwd;
    state.config = loadConfig(cwd);
    state.folders = resolveFolders(cwd, state.config);
    await state.index.refresh(cwd, state.folders);
  };

  pi.on('session_start', async (_event, ctx) => {
    await reload(ctx.cwd);
    registerAutocomplete(ctx, state);
    const count = state.index.getItems().length;
    ctx.ui.setStatus(
      'past-chats',
      count > 0 ? `💬 ${count} past chat${count === 1 ? '' : 's'}` : undefined,
    );
  });

  registerContextInjection(pi, state);
  registerCommands(pi, state, reload);
  registerSearchTool(pi, state);
}
