import dagre from '@dagrejs/dagre';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type DiagramSpec,
  type LayoutResult,
  type PlacedBox,
} from './types.js';

/** Padding added around a group's member nodes when drawing its frame. */
const GROUP_PADDING = 48;

/**
 * Validate a diagram spec before layout. Throws on structural problems the
 * Miro API can't recover from (duplicate ids, edges referencing unknown nodes).
 * Pure — no network, fully unit-testable.
 */
export function validateSpec(spec: DiagramSpec): void {
  if (!spec.nodes || spec.nodes.length === 0) {
    throw new Error('Diagram has no nodes.');
  }

  const ids = new Set<string>();
  for (const node of spec.nodes) {
    if (!node.id) throw new Error('Every node needs a non-empty id.');
    if (ids.has(node.id)) throw new Error(`Duplicate node id: "${node.id}".`);
    ids.add(node.id);
  }

  const groupIds = new Set((spec.groups ?? []).map((group) => group.id));
  for (const node of spec.nodes) {
    if (node.group !== undefined && !groupIds.has(node.group)) {
      throw new Error(`Node "${node.id}" references unknown group "${node.group}".`);
    }
  }

  for (const edge of spec.edges ?? []) {
    if (!ids.has(edge.from)) {
      throw new Error(`Edge references unknown node "${edge.from}".`);
    }
    if (!ids.has(edge.to)) {
      throw new Error(`Edge references unknown node "${edge.to}".`);
    }
  }
}

/**
 * Lay out a diagram with dagre. Nodes are grouped into dagre compound clusters
 * so members of the same group stay together; the cluster rectangle becomes the
 * group's frame bounds (expanded by GROUP_PADDING). dagre returns center
 * coordinates, which is exactly Miro's default position origin — so positions
 * pass straight through.
 */
export function layoutDiagram(spec: DiagramSpec): LayoutResult {
  validateSpec(spec);

  const graph = new dagre.graphlib.Graph({ compound: true });
  graph.setGraph({
    rankdir: spec.direction ?? 'TB',
    nodesep: 60,
    edgesep: 20,
    ranksep: 90,
    marginx: 20,
    marginy: 20,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const group of spec.groups ?? []) {
    graph.setNode(group.id, { label: group.label });
  }

  for (const node of spec.nodes) {
    graph.setNode(node.id, {
      width: node.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
    });
    if (node.group !== undefined) {
      graph.setParent(node.id, node.group);
    }
  }

  for (const edge of spec.edges ?? []) {
    graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const nodes = new Map<string, PlacedBox>();
  for (const node of spec.nodes) {
    const laid = graph.node(node.id);
    nodes.set(node.id, {
      x: laid.x,
      y: laid.y,
      width: laid.width,
      height: laid.height,
    });
  }

  const groups = new Map<string, PlacedBox>();
  for (const group of spec.groups ?? []) {
    const laid = graph.node(group.id) as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    if (laid?.x === undefined || laid?.width === undefined) continue;
    groups.set(group.id, {
      x: laid.x,
      y: laid.y as number,
      width: laid.width + GROUP_PADDING * 2,
      height: (laid.height as number) + GROUP_PADDING * 2,
    });
  }

  return { nodes, groups };
}
