import { describe, expect, test } from 'bun:test';
import { layoutDiagram, validateSpec } from '../extensions/miro/layout.js';
import type { DiagramSpec } from '../extensions/miro/types.js';

const linear: DiagramSpec = {
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ],
};

describe('validateSpec', () => {
  test('rejects empty node list', () => {
    expect(() => validateSpec({ nodes: [], edges: [] })).toThrow('no nodes');
  });

  test('rejects duplicate node ids', () => {
    expect(() =>
      validateSpec({
        nodes: [
          { id: 'x', label: '1' },
          { id: 'x', label: '2' },
        ],
        edges: [],
      }),
    ).toThrow('Duplicate node id');
  });

  test('rejects edge to unknown node', () => {
    expect(() =>
      validateSpec({ nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'ghost' }] }),
    ).toThrow('unknown node "ghost"');
  });

  test('rejects node referencing unknown group', () => {
    expect(() =>
      validateSpec({ nodes: [{ id: 'a', label: 'A', group: 'g1' }], edges: [] }),
    ).toThrow('unknown group "g1"');
  });
});

describe('layoutDiagram', () => {
  test('places every node with finite center + size', () => {
    const result = layoutDiagram(linear);
    expect(result.nodes.size).toBe(3);
    for (const box of result.nodes.values()) {
      expect(Number.isFinite(box.x)).toBe(true);
      expect(Number.isFinite(box.y)).toBe(true);
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
  });

  test('TB layout stacks successors below predecessors', () => {
    const result = layoutDiagram({ ...linear, direction: 'TB' });
    const a = result.nodes.get('a')!;
    const b = result.nodes.get('b')!;
    const c = result.nodes.get('c')!;
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
  });

  test('LR layout advances successors to the right', () => {
    const result = layoutDiagram({ ...linear, direction: 'LR' });
    const a = result.nodes.get('a')!;
    const c = result.nodes.get('c')!;
    expect(a.x).toBeLessThan(c.x);
  });

  test('produces a bounding box for groups with members', () => {
    const grouped: DiagramSpec = {
      nodes: [
        { id: 'a', label: 'A', group: 'g' },
        { id: 'b', label: 'B', group: 'g' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      groups: [{ id: 'g', label: 'Group' }],
    };
    const result = layoutDiagram(grouped);
    const box = result.groups.get('g');
    expect(box).toBeDefined();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('is deterministic across runs', () => {
    const a = layoutDiagram(linear);
    const b = layoutDiagram(linear);
    expect([...a.nodes.entries()]).toEqual([...b.nodes.entries()]);
  });
});
