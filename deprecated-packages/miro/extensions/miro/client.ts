import { MiroApi } from '@mirohq/miro-api';
import {
  type BoardItem,
  type ItemChanges,
  type ListableItemType,
  type RawItem,
  buildUpdateRequest,
  normalizeItem,
} from './items.js';
import type { ConnectorShape, NodeStyle, ShapeKind } from './types.js';

export interface BoardSummary {
  id: string;
  name: string;
  viewLink?: string;
}

export interface CreatedItem {
  id: string;
}

export interface ListItemsOptions {
  /** Filter to one item type (e.g. "shape", "frame"). */
  type?: ListableItemType;
  /** Only items inside this parent frame. */
  frameId?: string;
  /** Stop after this many items. Default 100. */
  limit?: number;
}

export interface DeleteResult {
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
}

export interface CreateShapeArgs {
  shape: ShapeKind;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: NodeStyle;
}

export interface CreateConnectorArgs {
  startItemId: string;
  endItemId: string;
  label?: string;
  shape?: ConnectorShape;
  /** Stroke color (hex). */
  color?: string;
}

export interface CreateFrameArgs {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Background fill (must be a Miro-allowed frame color). */
  fillColor?: string;
}

export interface CreateTextArgs {
  content: string;
  /** Center position of the text box (Miro origin). */
  x: number;
  y: number;
  /** Text box width; height is auto-sized by Miro. */
  width: number;
  /** Text color (hex). */
  color?: string;
  /** Font size in dp (string per Miro API). */
  fontSize?: string;
  /** Horizontal alignment. Default left for container titles. */
  textAlign?: 'left' | 'center' | 'right';
}

/**
 * Thin, typed wrapper over the low-level stateless `MiroApi`. Keeps all SDK
 * coupling in one place and normalizes the verbose create-request shapes into
 * the small argument objects the diagram/tool layers use.
 */
export class MiroClient {
  private readonly api: MiroApi;

  constructor(accessToken: string) {
    this.api = new MiroApi(accessToken);
  }

  async listBoards(limit = 50): Promise<BoardSummary[]> {
    const boards: BoardSummary[] = [];
    for await (const board of this.api.getAllBoards()) {
      boards.push({ id: board.id, name: board.name ?? '(untitled)', viewLink: board.viewLink });
      if (boards.length >= limit) break;
    }
    return boards;
  }

  /** Resolve the board's web view link (used in tool summaries). */
  async getBoardViewLink(boardId: string): Promise<string | undefined> {
    const board = await this.api.getBoard(boardId);
    return board.viewLink;
  }

  async createShape(boardId: string, args: CreateShapeArgs): Promise<CreatedItem> {
    const board = await this.api.getBoard(boardId);
    const item = await board.createShapeItem({
      data: { shape: args.shape, content: args.content },
      position: { x: args.x, y: args.y },
      geometry: { width: args.width, height: args.height },
      style: toShapeStyle(args.style),
    });
    return { id: item.id };
  }

  async createFrame(boardId: string, args: CreateFrameArgs): Promise<CreatedItem> {
    const board = await this.api.getBoard(boardId);
    const item = await board.createFrameItem({
      data: { title: args.title },
      position: { x: args.x, y: args.y },
      geometry: { width: args.width, height: args.height },
      style: args.fillColor ? { fillColor: args.fillColor } : undefined,
    });
    return { id: item.id };
  }

  async createText(boardId: string, args: CreateTextArgs): Promise<CreatedItem> {
    const board = await this.api.getBoard(boardId);
    const style: Record<string, string> = {};
    if (args.color) style.color = args.color;
    if (args.fontSize) style.fontSize = args.fontSize;
    if (args.textAlign) style.textAlign = args.textAlign;
    const item = await board.createTextItem({
      data: { content: args.content },
      position: { x: args.x, y: args.y },
      geometry: { width: args.width },
      style: Object.keys(style).length > 0 ? style : undefined,
    });
    return { id: item.id };
  }

  /** List items on a board, optionally filtered by type and/or parent frame. */
  async listItems(boardId: string, options: ListItemsOptions = {}): Promise<BoardItem[]> {
    const limit = options.limit ?? 100;
    const items: BoardItem[] = [];
    let cursor: string | undefined;
    do {
      const query = {
        ...(options.type ? { type: options.type } : {}),
        ...(cursor ? { cursor } : {}),
        limit: String(Math.min(50, limit - items.length)),
      };
      const page = options.frameId
        ? await this.api._api.getItemsWithinFrame(boardId, options.frameId, query)
        : await this.api._api.getItems(boardId, query);
      for (const raw of page.body.data ?? []) {
        items.push(normalizeItem(raw as RawItem));
        if (items.length >= limit) return items;
      }
      cursor = page.body.cursor || undefined;
    } while (cursor);
    return items;
  }

  /** Edit an existing item's content/position/size/colors. */
  async updateItem(boardId: string, itemId: string, changes: ItemChanges): Promise<BoardItem> {
    const current = (await this.api._api.getSpecificItem(boardId, itemId)).body as RawItem;
    const request = buildUpdateRequest(current.type, current, changes);
    switch (current.type) {
      case 'shape':
        await this.api._api.updateShapeItem(boardId, itemId, request as never);
        break;
      case 'text':
        await this.api._api.updateTextItem(boardId, itemId, request as never);
        break;
      case 'sticky_note':
        await this.api._api.updateStickyNoteItem(boardId, itemId, request as never);
        break;
      case 'frame':
        await this.api._api.updateFrameItem(boardId, itemId, request as never);
        break;
      default:
        // buildUpdateRequest already throws for non-updatable types.
        break;
    }
    const updated = (await this.api._api.getSpecificItem(boardId, itemId)).body as RawItem;
    return normalizeItem(updated);
  }

  /** Delete items by id, tolerating per-item failure. */
  async deleteItems(boardId: string, itemIds: string[]): Promise<DeleteResult> {
    const deleted: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const id of itemIds) {
      try {
        await this.api._api.deleteItem(boardId, id);
        deleted.push(id);
      } catch (err) {
        failed.push({ id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { deleted, failed };
  }

  async createConnector(boardId: string, args: CreateConnectorArgs): Promise<CreatedItem> {
    const board = await this.api.getBoard(boardId);
    const item = await board.createConnector({
      startItem: { id: args.startItemId },
      endItem: { id: args.endItemId },
      shape: args.shape ?? 'curved',
      captions: args.label ? [{ content: args.label }] : undefined,
      style: args.color ? { strokeColor: args.color, strokeWidth: '2' } : undefined,
    });
    return { id: item.id };
  }
}

function toShapeStyle(style?: NodeStyle): Record<string, string> | undefined {
  if (!style) return undefined;
  const mapped: Record<string, string> = {};
  if (style.fillColor) mapped.fillColor = style.fillColor;
  if (style.fillOpacity) mapped.fillOpacity = style.fillOpacity;
  if (style.textColor) mapped.color = style.textColor;
  if (style.borderColor) mapped.borderColor = style.borderColor;
  if (style.borderWidth) mapped.borderWidth = style.borderWidth;
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

/** Turn raw SDK/HTTP failures into short, actionable messages for the LLM. */
export function describeMiroError(err: unknown): string {
  const status = extractStatus(err);
  if (status === 401)
    return 'Miro auth failed (401): MIRO_ACCESS_TOKEN is missing, invalid, or expired.';
  if (status === 403) {
    return 'Miro access denied (403): the token lacks scopes (need boards:read/boards:write) or board access.';
  }
  if (status === 404) {
    return 'Miro board or item not found (404): pass an existing boardId (see `miro_list_boards`).';
  }
  if (status === 429) return 'Miro rate limit hit (429): wait a moment before retrying.';
  const message = err instanceof Error ? err.message : String(err);
  return `Miro request failed: ${message}`;
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  return typeof status === 'number' ? status : undefined;
}
