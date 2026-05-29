import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { saveConfig, CONFIG_FILE } from './config';
import { buildFolderListDisplay } from './prompt';
import type { ContextFoldersConfig, ResolvedFolder } from './types';
import fs from 'node:fs';

interface UI {
  setStatus(key: string, value: string | undefined): void;
}

interface State {
  config: ContextFoldersConfig;
  folders: ResolvedFolder[];
  cwd: string;
  reload: (ui: UI) => void;
}

export function registerCommands(pi: ExtensionAPI, getState: () => State): void {
  pi.registerCommand('context-folders', {
    description:
      'Manage context folders. Subcommands: list, add <path> [label], remove <path-or-label>, init',
    handler: async (args, ctx) => {
      const state = getState();
      const parts = args?.trim().split(/\s+/) ?? [];
      const subcommand = parts[0]?.toLowerCase() || 'list';

      switch (subcommand) {
        case 'list': {
          ctx.ui.notify(buildFolderListDisplay(state.folders), 'info');
          break;
        }

        case 'add': {
          const folderPath = parts[1];
          if (!folderPath) {
            ctx.ui.notify('Usage: /context-folders add <path> [label]', 'error');
            return;
          }
          const label = parts.slice(2).join(' ') || undefined;
          state.config.folders.push({ path: folderPath, label });
          saveConfig(state.cwd, state.config);
          state.reload(ctx.ui);
          const resolved = path.resolve(state.cwd, folderPath);
          ctx.ui.notify(
            `Added context folder: ${label || path.basename(resolved)} (${resolved})`,
            'info',
          );
          break;
        }

        case 'remove': {
          const query = parts.slice(1).join(' ');
          if (!query) {
            ctx.ui.notify('Usage: /context-folders remove <path-or-label>', 'error');
            return;
          }
          const idx = state.config.folders.findIndex(
            (f) =>
              f.path === query ||
              f.label === query ||
              path.resolve(state.cwd, f.path) === path.resolve(state.cwd, query),
          );
          if (idx === -1) {
            ctx.ui.notify(`No folder matching "${query}" found.`, 'error');
            return;
          }
          const removed = state.config.folders.splice(idx, 1)[0];
          saveConfig(state.cwd, state.config);
          state.reload(ctx.ui);
          ctx.ui.notify(`Removed context folder: ${removed.label || removed.path}`, 'info');
          break;
        }

        case 'init': {
          const filePath = path.join(state.cwd, CONFIG_FILE);
          if (fs.existsSync(filePath)) {
            ctx.ui.notify(`${CONFIG_FILE} already exists.`, 'info');
            return;
          }
          saveConfig(state.cwd, { folders: [] });
          ctx.ui.notify(`Created ${CONFIG_FILE}`, 'info');
          break;
        }

        default:
          ctx.ui.notify(
            'Unknown subcommand. Use: list, add <path> [label], remove <path-or-label>, init',
            'error',
          );
      }
    },
  });
}
