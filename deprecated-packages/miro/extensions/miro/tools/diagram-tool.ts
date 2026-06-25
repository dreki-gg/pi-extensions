import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';
import { describeMiroError } from '../client.js';
import { resolveBoardId } from '../config.js';
import { renderDiagram } from '../diagram.js';
import { CONNECTOR_SHAPES, SHAPE_KINDS, type DiagramSpec } from '../types.js';
import { type MiroRuntime, type ToolResult, errorResult, textResult } from '../runtime.js';

const nodeStyleSchema = Type.Object({
  fillColor: Type.Optional(Type.String({ description: 'Fill hex, e.g. "#e8f1fc".' })),
  borderColor: Type.Optional(Type.String({ description: 'Border hex.' })),
  textColor: Type.Optional(Type.String({ description: 'Text hex.' })),
});

const nodeSchema = Type.Object({
  id: Type.String({ description: 'Stable node id, referenced by edges and group membership.' }),
  label: Type.String({ description: 'Text shown inside the shape.' }),
  group: Type.Optional(
    Type.String({ description: 'Group id this node belongs to (drawn inside a container region).' }),
  ),
  shape: Type.Optional(
    StringEnum(SHAPE_KINDS, { description: 'Shape kind. Default from config (round_rectangle).' }),
  ),
  style: Type.Optional(
    Type.Object(nodeStyleSchema.properties, {
      description: 'Explicit color override. Wins over the automatic group color theme.',
    }),
  ),
});

const edgeSchema = Type.Object({
  from: Type.String({ description: 'Source node id.' }),
  to: Type.String({ description: 'Target node id.' }),
  label: Type.Optional(Type.String({ description: 'Optional connector caption.' })),
  shape: Type.Optional(
    StringEnum(CONNECTOR_SHAPES, { description: 'Connector path style. Default curved.' }),
  ),
});

const groupSchema = Type.Object({
  id: Type.String({ description: 'Group id referenced by node.group.' }),
  label: Type.String({ description: 'Title shown at the top of the group container.' }),
});

export const diagramToolSchema = Type.Object({
  boardId: Type.Optional(
    Type.String({ description: 'Existing board id. Defaults to defaultBoardId in .pi/miro.json.' }),
  ),
  frameTitle: Type.Optional(
    Type.String({
      description:
        'When set, wrap the whole diagram in one titled outer frame so it is easy to find (appears in the Frames panel). Recommended.',
    }),
  ),
  nodes: Type.Array(nodeSchema, { description: 'Diagram nodes (boxes).' }),
  edges: Type.Array(edgeSchema, { description: 'Directed connectors between nodes.' }),
  groups: Type.Optional(
    Type.Array(groupSchema, {
      description:
        'Optional groups, each rendered as a titled container shape (a backdrop region, not an artboard frame, so member nodes stay independent).',
    }),
  ),
  direction: Type.Optional(
    StringEnum(['TB', 'BT', 'LR', 'RL'] as const, {
      description: 'Layout direction. Default TB (top-bottom).',
    }),
  ),
  colorize: Type.Optional(
    Type.Boolean({
      description:
        'Auto color-code by group (frame fill + node fill/border + connector stroke). Default true.',
    }),
  ),
});

export type DiagramToolInput = {
  boardId?: string;
  frameTitle?: string;
  nodes: DiagramSpec['nodes'];
  edges: DiagramSpec['edges'];
  groups?: DiagramSpec['groups'];
  direction?: DiagramSpec['direction'];
  colorize?: boolean;
};

export function registerDiagramTool(
  pi: Pick<ExtensionAPI, 'registerTool'>,
  runtime: MiroRuntime,
): void {
  pi.registerTool({
    name: 'miro_create_diagram',
    label: 'Miro Create Diagram',
    description:
      'Render a node/edge diagram onto an existing Miro board. Auto-lays-out with dagre and creates native shapes, connectors, and group container regions.',
    promptSnippet: 'Create an auto-laid-out diagram (nodes + edges + groups) on a Miro board',
    promptGuidelines: [
      'Use miro_create_diagram to turn a graph (nodes + edges, optionally grouped) into native Miro items — this is the right tool for converting a Mermaid/architecture sketch into an editable board, not pasting an image.',
      'miro_create_diagram requires an existing board: it uses boardId or defaultBoardId from .pi/miro.json and never creates a board. Use miro_list_boards to find one.',
    ],
    parameters: diagramToolSchema,
    async execute(
      _toolCallId: string,
      params: DiagramToolInput,
      _signal?: AbortSignal,
      _onUpdate?: unknown,
      ctx?: { cwd: string },
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

      const spec: DiagramSpec = {
        nodes: params.nodes,
        edges: params.edges,
        groups: params.groups,
        direction: params.direction,
      };

      try {
        const result = await renderDiagram(built.client, boardId, spec, {
          defaultShape: config.defaultShape,
          wrapTitle: params.frameTitle,
          colorize: params.colorize,
        });
        let viewLink: string | undefined;
        try {
          viewLink = await built.client.getBoardViewLink(boardId);
        } catch {
          viewLink = undefined;
        }
        const summary =
          `✅ Created ${result.shapeIds.length} shapes, ${result.connectorIds.length} connectors, ` +
          `${result.containerIds.length} group containers, ${result.frameIds.length} frames ` +
          `on board ${boardId}.` +
          (viewLink ? `\n${viewLink}` : '');
        return textResult(summary, {
          boardId,
          viewLink,
          shapes: result.shapeIds.length,
          connectors: result.connectorIds.length,
          containers: result.containerIds.length,
          labels: result.textIds.length,
          frames: result.frameIds.length,
        });
      } catch (err) {
        return errorResult(describeMiroError(err), { error: 'render_failed' });
      }
    },
  });
}
