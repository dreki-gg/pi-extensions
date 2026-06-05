import { describe, expect, test } from 'bun:test';
import type {
  CreateConnectorArgs,
  CreateFrameArgs,
  CreateShapeArgs,
  CreateTextArgs,
  CreatedItem,
} from '../extensions/miro/client.js';
import { type DiagramClient, computeBounds, renderDiagram } from '../extensions/miro/diagram.js';
import { layoutDiagram } from '../extensions/miro/layout.js';
import type { DiagramSpec } from '../extensions/miro/types.js';

class FakeClient implements DiagramClient {
  shapes: Array<{ args: CreateShapeArgs }> = [];
  connectors: CreateConnectorArgs[] = [];
  frames: CreateFrameArgs[] = [];
  texts: CreateTextArgs[] = [];
  /** Ordered log of created item kinds, for z-order assertions. */
  order: string[] = [];
  private counter = 0;

  async createShape(_boardId: string, args: CreateShapeArgs): Promise<CreatedItem> {
    this.shapes.push({ args });
    this.order.push(`shape:${args.content}`);
    return { id: `shape-${args.content || ++this.counter}` };
  }
  async createFrame(_boardId: string, args: CreateFrameArgs): Promise<CreatedItem> {
    this.frames.push(args);
    this.order.push(`frame:${args.title}`);
    return { id: `frame-${++this.counter}` };
  }
  async createText(_boardId: string, args: CreateTextArgs): Promise<CreatedItem> {
    this.texts.push(args);
    this.order.push(`text:${args.content}`);
    return { id: `text-${++this.counter}` };
  }
  async createConnector(_boardId: string, args: CreateConnectorArgs): Promise<CreatedItem> {
    this.connectors.push(args);
    return { id: `conn-${++this.counter}` };
  }
}

const spec: DiagramSpec = {
  nodes: [
    { id: 'a', label: 'A', group: 'g' },
    { id: 'b', label: 'B', group: 'g' },
    { id: 'c', label: 'C' },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'next' },
    { from: 'b', to: 'c' },
  ],
  groups: [{ id: 'g', label: 'Group' }],
};

describe('renderDiagram', () => {
  test('creates a node shape per node, a container shape + title per group, connector per edge', async () => {
    const client = new FakeClient();
    const result = await renderDiagram(client, 'board1', spec, { defaultShape: 'rectangle' });

    // 3 node shapes + 1 group container shape.
    expect(client.shapes.length).toBe(4);
    // Groups are no longer frames; only the (absent) outer wrap would be one.
    expect(client.frames.length).toBe(0);
    expect(client.texts.length).toBe(1);
    expect(client.connectors.length).toBe(2);
    expect(result.shapeIds.length).toBe(3);
    expect(result.containerIds.length).toBe(1);
    expect(result.textIds.length).toBe(1);
    expect(result.connectorIds.length).toBe(2);
    expect(result.frameIds.length).toBe(0);
  });

  test('group container is a label-less shape drawn before its member nodes', async () => {
    const client = new FakeClient();
    await renderDiagram(client, 'board1', spec, { defaultShape: 'rectangle' });

    // The container shape carries no content (label lives in a separate text).
    const container = client.shapes.find((shape) => shape.args.content === '')!;
    expect(container).toBeDefined();
    expect(container.args.shape).toBe('round_rectangle');

    // Z-order: container created before any member node shape.
    const containerIdx = client.order.indexOf('shape:');
    const nodeAIdx = client.order.indexOf('shape:A');
    expect(containerIdx).toBeGreaterThanOrEqual(0);
    expect(containerIdx).toBeLessThan(nodeAIdx);
  });

  test('group title renders as a separate text item', async () => {
    const client = new FakeClient();
    await renderDiagram(client, 'board1', spec, { defaultShape: 'rectangle' });
    const title = client.texts.find((text) => text.content === 'Group')!;
    expect(title).toBeDefined();
    expect(title.textAlign).toBe('left');
  });

  test('wires connectors to the created shape ids (not node ids)', async () => {
    const client = new FakeClient();
    await renderDiagram(client, 'board1', spec, { defaultShape: 'rectangle' });

    const wired = client.connectors.find((connector) => connector.label === 'next')!;
    expect(wired.startItemId).toBe('shape-A');
    expect(wired.endItemId).toBe('shape-B');
  });

  test('falls back to the default shape when a node omits one', async () => {
    const client = new FakeClient();
    await renderDiagram(client, 'board1', spec, { defaultShape: 'hexagon' });
    // Container shapes are always round_rectangle; only node shapes follow the default.
    expect(
      client.shapes
        .filter((shape) => shape.args.content !== '')
        .every((shape) => shape.args.shape === 'hexagon'),
    ).toBe(true);
  });

  test('color-codes groups by default (container fill/opacity + node + connector)', async () => {
    const client = new FakeClient();
    await renderDiagram(client, 'board1', spec, { defaultShape: 'rectangle' });
    const container = client.shapes.find((shape) => shape.args.content === '')!;
    expect(container.args.style?.fillColor).toBeTruthy();
    expect(container.args.style?.fillOpacity).toBeTruthy();
    // Every node shape (non-container) is filled too.
    expect(
      client.shapes
        .filter((shape) => shape.args.content !== '')
        .every((shape) => shape.args.style?.fillColor),
    ).toBe(true);
    expect(client.texts.every((text) => text.color)).toBe(true);
    expect(client.connectors.every((connector) => connector.color)).toBe(true);
  });

  test('colorize:false leaves items unstyled', async () => {
    const client = new FakeClient();
    await renderDiagram(client, 'board1', spec, { defaultShape: 'rectangle', colorize: false });
    expect(client.shapes.every((shape) => shape.args.style === undefined)).toBe(true);
    expect(client.texts.every((text) => text.color === undefined)).toBe(true);
    expect(client.connectors.every((connector) => connector.color === undefined)).toBe(true);
  });

  test('explicit node style overrides the group theme', async () => {
    const client = new FakeClient();
    const styled: DiagramSpec = {
      nodes: [{ id: 'a', label: 'A', group: 'g', style: { fillColor: '#123456' } }],
      edges: [],
      groups: [{ id: 'g', label: 'G' }],
    };
    await renderDiagram(client, 'board1', styled, { defaultShape: 'rectangle' });
    const node = client.shapes.find((shape) => shape.args.content === 'A')!;
    expect(node.args.style?.fillColor).toBe('#123456');
  });

  test('wraps the diagram in one outer frame when frameTitle is set', async () => {
    const client = new FakeClient();
    const result = await renderDiagram(client, 'board1', spec, {
      defaultShape: 'rectangle',
      wrapTitle: 'My Map',
    });
    // Only the outer wrap is a frame now; the group is a container shape.
    expect(client.frames.length).toBe(1);
    expect(result.frameIds.length).toBe(1);
    const outer = client.frames[0];
    expect(outer.title).toBe('My Map');
    // Outer frame must be larger than the group container shape it encloses.
    const container = client.shapes.find((shape) => shape.args.content === '')!;
    expect(outer.width).toBeGreaterThan(container.args.width);
    expect(outer.height).toBeGreaterThan(container.args.height);
  });

  test('propagates validation errors from the spec', async () => {
    const client = new FakeClient();
    await expect(
      renderDiagram(
        client,
        'board1',
        { nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'x' }] },
        {
          defaultShape: 'rectangle',
        },
      ),
    ).rejects.toThrow('unknown node "x"');
  });
});

describe('computeBounds', () => {
  test('encloses every node with padding', () => {
    const layout = layoutDiagram(spec);
    const bounds = computeBounds(layout)!;
    expect(bounds).toBeDefined();
    for (const box of layout.nodes.values()) {
      expect(box.x - box.width / 2).toBeGreaterThanOrEqual(bounds.x - bounds.width / 2);
      expect(box.x + box.width / 2).toBeLessThanOrEqual(bounds.x + bounds.width / 2);
      expect(box.y - box.height / 2).toBeGreaterThanOrEqual(bounds.y - bounds.height / 2);
      expect(box.y + box.height / 2).toBeLessThanOrEqual(bounds.y + bounds.height / 2);
    }
  });

  test('returns undefined for an empty layout', () => {
    expect(computeBounds({ nodes: new Map() })).toBeUndefined();
  });
});
