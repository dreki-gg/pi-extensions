/**
 * Shared types for the Miro extension: the declarative diagram spec consumed
 * by `miro_create_diagram`, plus the small set of shape/connector vocabularies
 * exposed to the LLM.
 */

/** Miro shape kinds we surface to the LLM (a curated subset of the API set). */
export const SHAPE_KINDS = [
  'rectangle',
  'round_rectangle',
  'circle',
  'triangle',
  'rhombus',
  'parallelogram',
  'hexagon',
  'octagon',
  'cloud',
  'can',
  'right_arrow',
  'left_arrow',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Connector path styles supported by the Miro API. */
export const CONNECTOR_SHAPES = ['straight', 'elbowed', 'curved'] as const;
export type ConnectorShape = (typeof CONNECTOR_SHAPES)[number];

/** Optional per-node styling. Hex colors like "#1a1a1a". */
export interface NodeStyle {
  fillColor?: string;
  textColor?: string;
  borderColor?: string;
  /** Border thickness in px (string per Miro API). */
  borderWidth?: string;
}

export interface DiagramNode {
  id: string;
  label: string;
  /** Optional group id this node belongs to (renders inside a frame). */
  group?: string;
  shape?: ShapeKind;
  width?: number;
  height?: number;
  style?: NodeStyle;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  shape?: ConnectorShape;
}

export interface DiagramGroup {
  id: string;
  label: string;
}

export interface DiagramSpec {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
  /** Layout direction passed to dagre. Default "TB". */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
}

/** A laid-out rectangle in Miro's center-origin coordinate space. */
export interface PlacedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  /** nodeId -> center position + size. */
  nodes: Map<string, PlacedBox>;
  /** groupId -> bounding box (only for groups that have member nodes). */
  groups: Map<string, PlacedBox>;
}

export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 90;
