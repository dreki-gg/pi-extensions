import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';
import { describeMiroError } from '../client.js';
import { resolveBoardId } from '../config.js';
import { LISTABLE_ITEM_TYPES } from '../items.js';
import { type MiroRuntime, type ToolResult, errorResult, textResult } from '../runtime.js';

type PiLike = Pick<ExtensionAPI, 'registerTool'>;
type Ctx = { cwd: string };

export function registerItemTools(pi: PiLike, runtime: MiroRuntime): void {
  registerListItems(pi, runtime);
  registerUpdateItem(pi, runtime);
  registerDeleteItems(pi, runtime);
}

/** Resolve board + client, returning a ready error result on failure. */
async function resolve(
  runtime: MiroRuntime,
  boardIdParam: string | undefined,
  ctx?: Ctx,
): Promise<{ boardId: string; client: ReturnType<MiroRuntime['client']> } | { error: ToolResult }> {
  const config = await runtime.ensureConfig(ctx?.cwd);
  const built = runtime.client();
  if ('error' in built) return { error: built.error };
  try {
    return { boardId: resolveBoardId(boardIdParam, config), client: built };
  } catch (err) {
    return { error: errorResult((err as Error).message, { error: 'no_board' }) };
  }
}

function registerListItems(pi: PiLike, runtime: MiroRuntime): void {
  pi.registerTool({
    name: 'miro_list_items',
    label: 'Miro List Items',
    description:
      'List items on an existing board (id, type, label, position, size). Filter by type and/or parent frame. Use this to find item ids before connecting, updating, or deleting them.',
    promptSnippet: 'List items on a Miro board to find their ids',
    promptGuidelines: [
      'Use miro_list_items to discover item ids — miro_create_connector, miro_update_item, and miro_delete_items all need ids that only exist on the board.',
    ],
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({ description: 'Existing board id. Defaults to .pi/miro.json defaultBoardId.' }),
      ),
      type: Type.Optional(
        StringEnum(LISTABLE_ITEM_TYPES, { description: 'Only return items of this type.' }),
      ),
      frameId: Type.Optional(
        Type.String({ description: 'Only return items inside this parent frame id.' }),
      ),
      limit: Type.Optional(
        Type.Number({ description: 'Max items to return. Default 100.', minimum: 1, maximum: 500 }),
      ),
    }),
    async execute(
      _id: string,
      params: {
        boardId?: string;
        type?: (typeof LISTABLE_ITEM_TYPES)[number];
        frameId?: string;
        limit?: number;
      },
      _s?: AbortSignal,
      _u?: unknown,
      ctx?: Ctx,
    ): Promise<ToolResult> {
      const r = await resolve(runtime, params.boardId, ctx);
      if ('error' in r) return r.error;
      if ('error' in r.client) return r.client.error;
      try {
        const items = await r.client.client.listItems(r.boardId, {
          type: params.type,
          frameId: params.frameId,
          limit: params.limit,
        });
        if (items.length === 0) return textResult('No items found.', { items: [] });
        const lines = items.map((item) => {
          const label = item.label ? ` "${truncate(item.label)}"` : '';
          return `• ${item.type} ${item.id}${label}`;
        });
        return textResult(`Items (${items.length}):\n${lines.join('\n')}`, { items });
      } catch (err) {
        return errorResult(describeMiroError(err), { error: 'list_failed' });
      }
    },
  });
}

function registerUpdateItem(pi: PiLike, runtime: MiroRuntime): void {
  pi.registerTool({
    name: 'miro_update_item',
    label: 'Miro Update Item',
    description:
      'Edit an existing item (shape, text, sticky_note, or frame): change its text, position, size, or colors. Find the item id with miro_list_items.',
    promptSnippet: 'Update an existing Miro item by id',
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({ description: 'Existing board id. Defaults to .pi/miro.json defaultBoardId.' }),
      ),
      itemId: Type.String({ description: 'Id of the item to update.' }),
      content: Type.Optional(
        Type.String({ description: 'New text (shape/text/sticky content, or frame title).' }),
      ),
      x: Type.Optional(Type.Number({ description: 'New center x.' })),
      y: Type.Optional(Type.Number({ description: 'New center y.' })),
      width: Type.Optional(Type.Number({ description: 'New width.' })),
      height: Type.Optional(Type.Number({ description: 'New height (ignored for text items).' })),
      fillColor: Type.Optional(Type.String({ description: 'New fill hex, e.g. "#e8f1fc".' })),
      textColor: Type.Optional(Type.String({ description: 'New text hex.' })),
      borderColor: Type.Optional(Type.String({ description: 'New border hex (shapes only).' })),
    }),
    async execute(
      _id: string,
      params: {
        boardId?: string;
        itemId: string;
        content?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        fillColor?: string;
        textColor?: string;
        borderColor?: string;
      },
      _s?: AbortSignal,
      _u?: unknown,
      ctx?: Ctx,
    ): Promise<ToolResult> {
      const r = await resolve(runtime, params.boardId, ctx);
      if ('error' in r) return r.error;
      if ('error' in r.client) return r.client.error;
      const { boardId: _b, itemId, ...changes } = params;
      try {
        const item = await r.client.client.updateItem(r.boardId, itemId, changes);
        return textResult(`✅ Updated ${item.type} ${item.id} on board ${r.boardId}.`, {
          boardId: r.boardId,
          item,
        });
      } catch (err) {
        // buildUpdateRequest throws a clear message for non-updatable types.
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('not supported')) {
          return errorResult(message, { error: 'unsupported_type' });
        }
        return errorResult(describeMiroError(err), { error: 'update_failed' });
      }
    },
  });
}

function registerDeleteItems(pi: PiLike, runtime: MiroRuntime): void {
  pi.registerTool({
    name: 'miro_delete_items',
    label: 'Miro Delete Items',
    description:
      'Delete one or more items from a board by id. Tolerates per-item failure and reports which ids were deleted. Find ids with miro_list_items.',
    promptSnippet: 'Delete Miro items by id',
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({ description: 'Existing board id. Defaults to .pi/miro.json defaultBoardId.' }),
      ),
      itemIds: Type.Array(Type.String(), { description: 'Ids of the items to delete.', minItems: 1 }),
    }),
    async execute(
      _id: string,
      params: { boardId?: string; itemIds: string[] },
      _s?: AbortSignal,
      _u?: unknown,
      ctx?: Ctx,
    ): Promise<ToolResult> {
      const r = await resolve(runtime, params.boardId, ctx);
      if ('error' in r) return r.error;
      if ('error' in r.client) return r.client.error;
      try {
        const result = await r.client.client.deleteItems(r.boardId, params.itemIds);
        const failedNote = result.failed.length
          ? ` ${result.failed.length} failed (${result.failed.map((f) => f.id).join(', ')}).`
          : '';
        return textResult(
          `✅ Deleted ${result.deleted.length} item(s) on board ${r.boardId}.${failedNote}`,
          { boardId: r.boardId, ...result },
        );
      } catch (err) {
        return errorResult(describeMiroError(err), { error: 'delete_failed' });
      }
    },
  });
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
