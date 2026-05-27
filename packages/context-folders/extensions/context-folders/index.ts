import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { loadConfig, resolveFolders } from './config';
import { buildContextFoldersPrompt } from './prompt';
import { registerCommands } from './commands';
import type { ContextFoldersConfig, ResolvedFolder } from './types';

export default function contextFoldersExtension(pi: ExtensionAPI): void {
  let config: ContextFoldersConfig = { folders: [] };
  let resolvedFolders: ResolvedFolder[] = [];
  let cwd = '';

  function updateStatus(ui: { setStatus(key: string, value: string | undefined): void }): void {
    const validCount = resolvedFolders.filter((f) => f.exists).length;
    if (validCount > 0) {
      ui.setStatus('ctx-folders', `📁 ${validCount} context folder${validCount > 1 ? 's' : ''}`);
    } else {
      ui.setStatus('ctx-folders', undefined);
    }
  }

  function injectFolderContext(): void {
    const validFolders = resolvedFolders.filter((f) => f.exists);
    if (validFolders.length === 0) return;

    const prompt = buildContextFoldersPrompt(validFolders);
    pi.sendMessage(
      { customType: 'context-folders-info', content: prompt, display: false },
      { triggerTurn: false },
    );
  }

  pi.on('session_start', async (_event, ctx) => {
    cwd = ctx.cwd;
    config = loadConfig(cwd);
    resolvedFolders = resolveFolders(cwd, config);

    updateStatus(ctx.ui);
    injectFolderContext();
  });

  registerCommands(pi, () => ({
    config,
    folders: resolvedFolders,
    cwd,
    reload: (ui) => {
      config = loadConfig(cwd);
      resolvedFolders = resolveFolders(cwd, config);
      updateStatus(ui);
      injectFolderContext();
    },
  }));
}
