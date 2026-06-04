import { describe, expect, test } from 'bun:test';
import type {
  CreateConnectorArgs,
  CreateFrameArgs,
  CreateShapeArgs,
  CreatedItem,
} from '../extensions/miro/client.js';
import { type DiagramClient, renderDiagram } from '../extensions/miro/diagram.js';
import type { DiagramSpec } from '../extensions/miro/types.js';

class FakeClient implements DiagramClient {
  shapes: Array<{ args: CreateShapeArgs }> = [];
  connectors: CreateConnectorArgs[] = [];
  frames: CreateFrameArgs[] = [];
  private counter = 0;

  async createShape(_boardId: string, args: CreateShapeArgs): Promise<CreatedItem> {
    this.shapes.push({ args });
    return { id: `shape-${args.content}` };
  }
  async createFrame(_boardId: string, args: CreateFrameArgs): Promise<CreatedItem> {
    this.frames.push(args);
    return { id: `frame-${++this.counter}` };
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
  test('creates a shape per node, frame per group, connector per edge', async () => {
    const client = new FakeClient();
    const result = await renderDiagram(client, 'board1', spec, { defaultShape: 'rectangle' });

    expect(client.shapes.length).toBe(3);
    expect(client.frames.length).toBe(1);
    expect(client.connectors.length).toBe(2);
    expect(result.shapeIds.length).toBe(3);
    expect(result.connectorIds.length).toBe(2);
    expect(result.frameIds.length).toBe(1);
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
    expect(client.shapes.every((shape) => shape.args.shape === 'hexagon')).toBe(true);
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
