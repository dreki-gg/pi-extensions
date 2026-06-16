import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { addFolder, removeFolder, saveConfig } from './config';
import { buildContextPack, getSummaryForItem } from './summary';
import type { PastChatsRuntimeState } from './types';
import { getPastChatsCompletions } from './completions';

function splitArgs(args: string): [string, string] {
  const trimmed = args.trim();
  if (!trimmed) return ['list', ''];
  const [command = 'list', ...rest] = trimmed.split(/\s+/);
  return [command, rest.join(' ')];
}

function parseAddArgs(rest: string): { path: string; label?: string } | undefined {
  const trimmed = rest.trim();
  if (!trimmed) return undefined;
  const [folderPath = '', ...labelParts] = trimmed.split(/\s+/);
  return { path: folderPath, ...(labelParts.length ? { label: labelParts.join(' ') } : {}) };
}

function notify(
  ctx: ExtensionCommandContext,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (ctx.hasUI) ctx.ui.notify(message, level);
}

async function commandList(
  ctx: ExtensionCommandContext,
  state: PastChatsRuntimeState,
): Promise<void> {
  const currentCount = state.index.getItems().filter((item) => item.source.current).length;
  const lines = [
    `Current folder: ${state.cwd} (${currentCount} sessions)`,
    ...state.folders.map((folder) => {
      const count = state.index.getItems().filter((item) => item.source.cwd === folder.path).length;
      return `${folder.exists ? '✓' : '✗'} ${folder.label}: ${folder.path} (${count} sessions)`;
    }),
  ];

  notify(ctx, lines.join('\n'));
}

async function commandSummarize(
  token: string,
  ctx: ExtensionCommandContext,
  state: PastChatsRuntimeState,
): Promise<void> {
  const item = state.index.resolveToken(token.trim());
  if (!item) {
    notify(ctx, `past-chats: token not found: ${token}`, 'error');
    return;
  }

  const summary = await getSummaryForItem(ctx, state.cwd, state.config, item, { forceAi: true });
  const pack = buildContextPack(item, summary);

  if (!ctx.hasUI) return;
  const edited = await ctx.ui.editor('Past chat summary', pack);
  if (edited !== undefined) ctx.ui.setEditorText(edited);
}

export function registerCommands(
  pi: ExtensionAPI,
  state: PastChatsRuntimeState,
  reload: (cwd?: string) => Promise<void>,
): void {
  pi.registerCommand('past-chats', {
    description: 'Manage @chat/@session references (list, add, remove, refresh, summarize).',
    getArgumentCompletions: (argumentPrefix) => getPastChatsCompletions(argumentPrefix),
    handler: async (args, ctx) => {
      const [command, rest] = splitArgs(args);

      switch (command) {
        case 'list':
          await commandList(ctx, state);
          return;

        case 'add': {
          const parsed = parseAddArgs(rest);
          if (!parsed) {
            notify(ctx, 'Usage: /past-chats add <path> [label]', 'error');
            return;
          }
          state.config = addFolder(state.config, parsed.path, parsed.label);
          saveConfig(state.cwd || ctx.cwd, state.config);
          await reload(ctx.cwd);
          notify(
            ctx,
            `past-chats: added ${parsed.path}${parsed.label ? ` (${parsed.label})` : ''}`,
          );
          return;
        }

        case 'remove': {
          const target = rest.trim();
          if (!target) {
            notify(ctx, 'Usage: /past-chats remove <label|path>', 'error');
            return;
          }
          state.config = removeFolder(state.config, target);
          saveConfig(state.cwd || ctx.cwd, state.config);
          await reload(ctx.cwd);
          notify(ctx, `past-chats: removed ${target}`);
          return;
        }

        case 'refresh':
          await reload(ctx.cwd);
          notify(ctx, `past-chats: indexed ${state.index.getItems().length} session(s).`);
          return;

        case 'summarize':
          await commandSummarize(rest.trim(), ctx, state);
          return;

        default:
          notify(ctx, `Unknown /past-chats command: ${command}`, 'error');
      }
    },
  });
}
