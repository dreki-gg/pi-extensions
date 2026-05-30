import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { buildContextPack, getSummaryForItem } from './summary';
import type { PastChatsRuntimeState } from './types';
import { extractReferenceTokens } from './tokens';

export function registerContextInjection(pi: ExtensionAPI, state: PastChatsRuntimeState): void {
  pi.on('before_agent_start', async (event, ctx) => {
    const tokens = extractReferenceTokens(event.prompt);
    if (tokens.length === 0) return undefined;

    if (state.index.getItems().length === 0) {
      await state.index.refresh(ctx.cwd, state.folders);
    }

    const resolved = tokens.flatMap((token) => {
      const item = state.index.resolveToken(token);
      return item ? [{ token, item }] : [];
    });
    const unresolved = tokens.filter((token) => !state.index.resolveToken(token));

    if (unresolved.length > 0 && ctx.hasUI) {
      ctx.ui.notify(`past-chats: unresolved reference(s): ${unresolved.join(', ')}`, 'warning');
    }

    if (resolved.length === 0) {
      return {
        message: {
          customType: 'past-chats-context',
          content: `The prompt referenced past chat token(s), but none could be resolved: ${unresolved.join(', ')}`,
          display: true,
          details: { unresolved },
        },
      };
    }

    const packs: string[] = [];
    const seen = new Set<string>();
    for (const { item } of resolved) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const summary = await getSummaryForItem(ctx, state.cwd || ctx.cwd, state.config, item);
      packs.push(buildContextPack(item, summary));
    }

    const content = [
      '# Past chat references attached by @chat/@session',
      'The user referenced previous Pi sessions in their prompt. Use this context to understand those references. If more detail is needed, inspect the listed session JSONL files with tools.',
      '',
      ...packs,
      ...(unresolved.length ? ['', `Unresolved tokens: ${unresolved.join(', ')}`] : []),
    ].join('\n');

    if (ctx.hasUI) {
      ctx.ui.notify(`Attached ${packs.length} past chat reference${packs.length === 1 ? '' : 's'}.`, 'info');
    }

    return {
      message: {
        customType: 'past-chats-context',
        content,
        display: false,
        details: {
          tokens,
          resolved: resolved.map(({ token, item }) => ({ token, id: item.id, path: item.session.path })),
          unresolved,
        },
      },
    };
  });
}
