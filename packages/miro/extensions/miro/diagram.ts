import type {
  CreateConnectorArgs,
  CreateFrameArgs,
  CreateShapeArgs,
  CreatedItem,
} from './client.js';
import { layoutDiagram } from './layout.js';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type DiagramSpec,
  type ShapeKind,
} from './types.js';

/** The slice of `MiroClient` the diagram renderer depends on (mockable). */
export interface DiagramClient {
  createShape(boardId: string, args: CreateShapeArgs): Promise<CreatedItem>;
  createFrame(boardId: string, args: CreateFrameArgs): Promise<CreatedItem>;
  createConnector(boardId: string, args: CreateConnectorArgs): Promise<CreatedItem>;
}

export interface RenderOptions {
  defaultShape: ShapeKind;
  /** Max concurrent create calls. Default 4 — gentle on Miro rate limits. */
  concurrency?: number;
}

export interface RenderResult {
  frameIds: string[];
  shapeIds: string[];
  connectorIds: string[];
}

/**
 * Render a declarative diagram onto an existing board: frames first (so nodes
 * draw on top), then shapes (capturing nodeId -> Miro item id), then connectors
 * wired via that id map. Creation is batched with a small concurrency pool.
 */
export async function renderDiagram(
  client: DiagramClient,
  boardId: string,
  spec: DiagramSpec,
  options: RenderOptions,
): Promise<RenderResult> {
  const layout = layoutDiagram(spec);
  const concurrency = options.concurrency ?? 4;

  // 1. Group frames (behind everything).
  const frameIds: string[] = [];
  for (const group of spec.groups ?? []) {
    const box = layout.groups.get(group.id);
    if (!box) continue;
    const frame = await client.createFrame(boardId, {
      title: group.label,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    frameIds.push(frame.id);
  }

  // 2. Shapes, keeping the nodeId -> Miro item id map for connector wiring.
  const idMap = new Map<string, string>();
  await runPool(spec.nodes, concurrency, async (node) => {
    const box = layout.nodes.get(node.id);
    if (!box) return;
    const created = await client.createShape(boardId, {
      shape: node.shape ?? options.defaultShape,
      content: node.label,
      x: box.x,
      y: box.y,
      width: node.width ?? box.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? box.height ?? DEFAULT_NODE_HEIGHT,
      style: node.style,
    });
    idMap.set(node.id, created.id);
  });

  // 3. Connectors.
  const connectorIds: string[] = [];
  await runPool(spec.edges ?? [], concurrency, async (edge) => {
    const startItemId = idMap.get(edge.from);
    const endItemId = idMap.get(edge.to);
    if (!startItemId || !endItemId) return;
    const created = await client.createConnector(boardId, {
      startItemId,
      endItemId,
      label: edge.label,
      shape: edge.shape,
    });
    connectorIds.push(created.id);
  });

  return { frameIds, shapeIds: [...idMap.values()], connectorIds };
}

/**
 * Run `worker` over `items` with a bounded number of concurrent promises,
 * preserving order-independence. Rejects on the first worker error.
 */
async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const size = Math.max(1, Math.min(limit, queue.length || 1));
  const runners = Array.from({ length: size }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) break;
      await worker(next);
    }
  });
  await Promise.all(runners);
}
