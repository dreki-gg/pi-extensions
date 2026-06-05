import type {
  CreateConnectorArgs,
  CreateFrameArgs,
  CreateShapeArgs,
  CreateTextArgs,
  CreatedItem,
} from './client.js';
import { layoutDiagram } from './layout.js';
import {
  NEUTRAL_THEME,
  assignGroupThemes,
  themeContainerStyle,
  themeContainerTitleColor,
} from './theme.js';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type DiagramSpec,
  type NodeStyle,
  type ShapeKind,
} from './types.js';

/** The slice of `MiroClient` the diagram renderer depends on (mockable). */
export interface DiagramClient {
  createShape(boardId: string, args: CreateShapeArgs): Promise<CreatedItem>;
  createFrame(boardId: string, args: CreateFrameArgs): Promise<CreatedItem>;
  createText(boardId: string, args: CreateTextArgs): Promise<CreatedItem>;
  createConnector(boardId: string, args: CreateConnectorArgs): Promise<CreatedItem>;
}

export interface RenderOptions {
  defaultShape: ShapeKind;
  /** Max concurrent create calls. Default 4 — gentle on Miro rate limits. */
  concurrency?: number;
  /**
   * When set, wrap the whole diagram in one titled outer frame. This makes the
   * result a single findable unit (shows in Miro's Frames panel — click to jump
   * to it) instead of free-floating items at the canvas origin.
   */
  wrapTitle?: string;
  /**
   * Auto color-code by group (frame fill + node fill/border + connector stroke).
   * Default true. Explicit per-node `style` always wins over the group theme.
   */
  colorize?: boolean;
}

export interface RenderResult {
  /** Outer wrapping frame ids (the only frames we still create). */
  frameIds: string[];
  /** Group container backdrop shape ids. */
  containerIds: string[];
  /** Group title text item ids. */
  textIds: string[];
  shapeIds: string[];
  connectorIds: string[];
}

/** Shape kind used for group container backdrops. */
const CONTAINER_SHAPE: ShapeKind = 'round_rectangle';
/** Inset of the title text from the container's top-left corner. */
const CONTAINER_TITLE_INSET = 24;
/** Title font size for group containers (dp). */
const CONTAINER_TITLE_FONT_SIZE = '18';

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
  const colorize = options.colorize ?? true;
  const themes = colorize
    ? assignGroupThemes((spec.groups ?? []).map((group) => group.id))
    : undefined;
  const groupOf = new Map(spec.nodes.map((node) => [node.id, node.group]));

  const frameIds: string[] = [];
  const containerIds: string[] = [];
  const textIds: string[] = [];

  // 0. Optional outer wrapping frame (created first → sits behind everything,
  // and becomes the single anchor in the Frames panel).
  if (options.wrapTitle) {
    const bounds = computeBounds(layout);
    if (bounds) {
      const outer = await client.createFrame(boardId, {
        title: options.wrapTitle,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
      frameIds.push(outer.id);
    }
  }

  // 1. Group containers (behind nodes). Each group is a backdrop SHAPE (not a
  // frame — frames are artboards that would capture member nodes as children)
  // plus a separate top-left title text item. Created before nodes so they sit
  // behind them by z-order.
  for (const group of spec.groups ?? []) {
    const box = layout.groups.get(group.id);
    if (!box) continue;
    const container = await client.createShape(boardId, {
      shape: CONTAINER_SHAPE,
      content: '',
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      style: themeContainerStyle(themes?.get(group.id)),
    });
    containerIds.push(container.id);

    const title = await client.createText(boardId, {
      content: group.label,
      x: box.x,
      y: box.y - box.height / 2 + CONTAINER_TITLE_INSET,
      width: box.width - CONTAINER_TITLE_INSET * 2,
      color: colorize ? themeContainerTitleColor(themes?.get(group.id)) : undefined,
      fontSize: CONTAINER_TITLE_FONT_SIZE,
      textAlign: 'left',
    });
    textIds.push(title.id);
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
      style: node.style ?? themeNodeStyle(themes, node.group),
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
      color: themeConnectorColor(themes, groupOf.get(edge.from)),
    });
    connectorIds.push(created.id);
  });

  return { frameIds, containerIds, textIds, shapeIds: [...idMap.values()], connectorIds };
}

/** Build the node fill/border/text style for a node from its group theme. */
function themeNodeStyle(
  themes: Map<string, import('./theme.js').GroupTheme> | undefined,
  group: string | undefined,
): NodeStyle | undefined {
  if (!themes) return undefined;
  const theme = group ? themes.get(group) : undefined;
  if (!theme) {
    // Ungrouped node → neutral dark chip with light text (entry points pop).
    return {
      fillColor: NEUTRAL_THEME.nodeFill,
      borderColor: NEUTRAL_THEME.nodeBorder,
      textColor: '#ffffff',
      borderWidth: '2',
    };
  }
  return {
    fillColor: theme.nodeFill,
    borderColor: theme.nodeBorder,
    textColor: '#1f2436',
    borderWidth: '2',
  };
}

/** Connector stroke color from the source node's group theme. */
function themeConnectorColor(
  themes: Map<string, import('./theme.js').GroupTheme> | undefined,
  group: string | undefined,
): string | undefined {
  if (!themes) return undefined;
  const theme = group ? themes.get(group) : undefined;
  return theme?.connector ?? NEUTRAL_THEME.connector;
}

/** Padding around the whole layout for the outer wrapping frame. */
const WRAP_PADDING = 80;
/** Extra top room so the frame title bar doesn't overlap the first row. */
const WRAP_TITLE_HEADROOM = 60;

/**
 * Axis-aligned bounding box of every placed node + group, expanded for the
 * outer wrapping frame (with extra headroom on top for the title bar).
 * Returns undefined when there is nothing to wrap.
 */
export function computeBounds(layout: {
  nodes: Map<string, { x: number; y: number; width: number; height: number }>;
  groups?: Map<string, { x: number; y: number; width: number; height: number }>;
}): { x: number; y: number; width: number; height: number } | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  // Include group frames too — they extend past their member nodes (group
  // padding), so the outer frame must enclose them, not just the raw nodes.
  const boxes = [...layout.nodes.values(), ...(layout.groups?.values() ?? [])];
  for (const box of boxes) {
    minX = Math.min(minX, box.x - box.width / 2);
    minY = Math.min(minY, box.y - box.height / 2);
    maxX = Math.max(maxX, box.x + box.width / 2);
    maxY = Math.max(maxY, box.y + box.height / 2);
  }
  if (!Number.isFinite(minX)) return undefined;

  const left = minX - WRAP_PADDING;
  const right = maxX + WRAP_PADDING;
  const top = minY - WRAP_PADDING - WRAP_TITLE_HEADROOM;
  const bottom = maxY + WRAP_PADDING;
  const width = right - left;
  const height = bottom - top;
  return { x: left + width / 2, y: top + height / 2, width, height };
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
