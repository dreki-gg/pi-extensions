import { MiroApi } from '@mirohq/miro-api';
import type { ConnectorShape, NodeStyle, ShapeKind } from './types.js';

export interface BoardSummary {
  id: string;
  name: string;
  viewLink?: string;
}

export interface CreatedItem {
  id: string;
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
}

export interface CreateFrameArgs {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
    });
    return { id: item.id };
  }

  async createConnector(boardId: string, args: CreateConnectorArgs): Promise<CreatedItem> {
    const board = await this.api.getBoard(boardId);
    const item = await board.createConnector({
      startItem: { id: args.startItemId },
      endItem: { id: args.endItemId },
      shape: args.shape ?? 'curved',
      captions: args.label ? [{ content: args.label }] : undefined,
    });
    return { id: item.id };
  }
}

function toShapeStyle(style?: NodeStyle): Record<string, string> | undefined {
  if (!style) return undefined;
  const mapped: Record<string, string> = {};
  if (style.fillColor) mapped.fillColor = style.fillColor;
  if (style.textColor) mapped.color = style.textColor;
  if (style.borderColor) mapped.borderColor = style.borderColor;
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
