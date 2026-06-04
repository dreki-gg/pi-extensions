import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';
import { describeMiroError } from '../client.js';
import { resolveBoardId } from '../config.js';
import {
  CONNECTOR_SHAPES,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  SHAPE_KINDS,
} from '../types.js';
import { type MiroRuntime, type ToolResult, errorResult, textResult } from '../runtime.js';

type PiLike = Pick<ExtensionAPI, 'registerTool'>;
type Ctx = { cwd: string };

export function registerPrimitiveTools(pi: PiLike, runtime: MiroRuntime): void {
  registerListBoards(pi, runtime);
  registerCreateShape(pi, runtime);
  registerCreateConnector(pi, runtime);
  registerCreateFrame(pi, runtime);
}

function registerListBoards(pi: PiLike, runtime: MiroRuntime): void {
  pi.registerTool({
    name: 'miro_list_boards',
    label: 'Miro List Boards',
    description: 'List Miro boards accessible to the configured access token (id, name, link).',
    promptSnippet: 'List accessible Miro boards to find a boardId',
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({ description: 'Max boards to return. Default 50.', minimum: 1, maximum: 100 }),
      ),
    }),
    async execute(
      _id: string,
      params: { limit?: number },
      _s?: AbortSignal,
      _u?: unknown,
      _ctx?: Ctx,
    ): Promise<ToolResult> {
      const built = runtime.client();
      if ('error' in built) return built.error;
      try {
        const boards = await built.client.listBoards(params.limit ?? 50);
        if (boards.length === 0)
          return textResult('No boards accessible to this token.', { boards: [] });
        const lines = boards.map(
          (board) => `• ${board.name} — ${board.id}${board.viewLink ? ` (${board.viewLink})` : ''}`,
        );
        return textResult(`Boards (${boards.length}):\n${lines.join('\n')}`, { boards });
      } catch (err) {
        return errorResult(describeMiroError(err), { error: 'list_failed' });
      }
    },
  });
}

function registerCreateShape(pi: PiLike, runtime: MiroRuntime): void {
  pi.registerTool({
    name: 'miro_create_shape',
    label: 'Miro Create Shape',
    description: 'Create a single shape on an existing board at an absolute position.',
    promptSnippet: 'Create one shape on a Miro board',
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({
          description: 'Existing board id. Defaults to .pi/miro.json defaultBoardId.',
        }),
      ),
      shape: Type.Optional(
        StringEnum(SHAPE_KINDS, { description: 'Shape kind. Default from config.' }),
      ),
      content: Type.String({ description: 'Text inside the shape.' }),
      x: Type.Number({ description: 'Center x (board coordinates).' }),
      y: Type.Number({ description: 'Center y (board coordinates).' }),
      width: Type.Optional(Type.Number({ description: `Width. Default ${DEFAULT_NODE_WIDTH}.` })),
      height: Type.Optional(
        Type.Number({ description: `Height. Default ${DEFAULT_NODE_HEIGHT}.` }),
      ),
    }),
    async execute(
      _id: string,
      params: {
        boardId?: string;
        shape?: (typeof SHAPE_KINDS)[number];
        content: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
      },
      _s?: AbortSignal,
      _u?: unknown,
      ctx?: Ctx,
    ): Promise<ToolResult> {
      const config = await runtime.ensureConfig(ctx?.cwd);
      const built = runtime.client();
      if ('error' in built) return built.error;
      let boardId: string;
      try {
        boardId = resolveBoardId(params.boardId, config);
      } catch (err) {
        return errorResult((err as Error).message, { error: 'no_board' });
      }
      try {
        const item = await built.client.createShape(boardId, {
          shape: params.shape ?? config.defaultShape,
          content: params.content,
          x: params.x,
          y: params.y,
          width: params.width ?? DEFAULT_NODE_WIDTH,
          height: params.height ?? DEFAULT_NODE_HEIGHT,
        });
        return textResult(`✅ Created shape ${item.id} on board ${boardId}.`, {
          boardId,
          itemId: item.id,
        });
      } catch (err) {
        return errorResult(describeMiroError(err), { error: 'create_failed' });
      }
    },
  });
}

function registerCreateConnector(pi: PiLike, runtime: MiroRuntime): void {
  pi.registerTool({
    name: 'miro_create_connector',
    label: 'Miro Create Connector',
    description: 'Connect two existing items on a board with a connector line.',
    promptSnippet: 'Connect two Miro items with a connector',
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({
          description: 'Existing board id. Defaults to .pi/miro.json defaultBoardId.',
        }),
      ),
      startItemId: Type.String({ description: 'Id of the source item.' }),
      endItemId: Type.String({ description: 'Id of the target item.' }),
      label: Type.Optional(
        Type.String({ description: 'Optional caption shown on the connector.' }),
      ),
      shape: Type.Optional(
        StringEnum(CONNECTOR_SHAPES, { description: 'Path style. Default curved.' }),
      ),
    }),
    async execute(
      _id: string,
      params: {
        boardId?: string;
        startItemId: string;
        endItemId: string;
        label?: string;
        shape?: (typeof CONNECTOR_SHAPES)[number];
      },
      _s?: AbortSignal,
      _u?: unknown,
      ctx?: Ctx,
    ): Promise<ToolResult> {
      const config = await runtime.ensureConfig(ctx?.cwd);
      const built = runtime.client();
      if ('error' in built) return built.error;
      let boardId: string;
      try {
        boardId = resolveBoardId(params.boardId, config);
      } catch (err) {
        return errorResult((err as Error).message, { error: 'no_board' });
      }
      try {
        const item = await built.client.createConnector(boardId, {
          startItemId: params.startItemId,
          endItemId: params.endItemId,
          label: params.label,
          shape: params.shape,
        });
        return textResult(`✅ Created connector ${item.id} on board ${boardId}.`, {
          boardId,
          itemId: item.id,
        });
      } catch (err) {
        return errorResult(describeMiroError(err), { error: 'create_failed' });
      }
    },
  });
}

function registerCreateFrame(pi: PiLike, runtime: MiroRuntime): void {
  pi.registerTool({
    name: 'miro_create_frame',
    label: 'Miro Create Frame',
    description: 'Create a titled frame (container region) on an existing board.',
    promptSnippet: 'Create a titled frame on a Miro board',
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({
          description: 'Existing board id. Defaults to .pi/miro.json defaultBoardId.',
        }),
      ),
      title: Type.String({ description: 'Frame title.' }),
      x: Type.Number({ description: 'Center x.' }),
      y: Type.Number({ description: 'Center y.' }),
      width: Type.Number({ description: 'Frame width.' }),
      height: Type.Number({ description: 'Frame height.' }),
    }),
    async execute(
      _id: string,
      params: {
        boardId?: string;
        title: string;
        x: number;
        y: number;
        width: number;
        height: number;
      },
      _s?: AbortSignal,
      _u?: unknown,
      ctx?: Ctx,
    ): Promise<ToolResult> {
      const config = await runtime.ensureConfig(ctx?.cwd);
      const built = runtime.client();
      if ('error' in built) return built.error;
      let boardId: string;
      try {
        boardId = resolveBoardId(params.boardId, config);
      } catch (err) {
        return errorResult((err as Error).message, { error: 'no_board' });
      }
      try {
        const item = await built.client.createFrame(boardId, {
          title: params.title,
          x: params.x,
          y: params.y,
          width: params.width,
          height: params.height,
        });
        return textResult(`✅ Created frame ${item.id} on board ${boardId}.`, {
          boardId,
          itemId: item.id,
        });
      } catch (err) {
        return errorResult(describeMiroError(err), { error: 'create_failed' });
      }
    },
  });
}
