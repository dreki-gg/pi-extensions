import { describe, expect, test } from 'bun:test';
import {
  type RawItem,
  buildUpdateRequest,
  isUpdatableType,
  normalizeItem,
} from '../extensions/miro/items.js';

describe('normalizeItem', () => {
  test('flattens shape content + position + geometry', () => {
    const raw: RawItem = {
      id: '1',
      type: 'shape',
      position: { x: 10, y: 20 },
      geometry: { width: 100, height: 40 },
      data: { content: 'Hello' },
    };
    expect(normalizeItem(raw)).toEqual({
      id: '1',
      type: 'shape',
      label: 'Hello',
      x: 10,
      y: 20,
      width: 100,
      height: 40,
    });
  });

  test('uses title as the label for frames', () => {
    const raw: RawItem = { id: '2', type: 'frame', data: { title: 'My Frame' } };
    expect(normalizeItem(raw).label).toBe('My Frame');
  });

  test('omits absent fields (no label/position/geometry)', () => {
    const raw: RawItem = { id: '3', type: 'image' };
    expect(normalizeItem(raw)).toEqual({ id: '3', type: 'image' });
  });
});

describe('isUpdatableType', () => {
  test('accepts shape/text/sticky_note/frame, rejects others', () => {
    expect(isUpdatableType('shape')).toBe(true);
    expect(isUpdatableType('text')).toBe(true);
    expect(isUpdatableType('sticky_note')).toBe(true);
    expect(isUpdatableType('frame')).toBe(true);
    expect(isUpdatableType('image')).toBe(false);
    expect(isUpdatableType('connector')).toBe(false);
  });
});

describe('buildUpdateRequest', () => {
  const current: RawItem = {
    id: '1',
    type: 'shape',
    position: { x: 5, y: 6 },
    geometry: { width: 200, height: 90 },
  };

  test('maps content to data.content for shapes', () => {
    const req = buildUpdateRequest('shape', current, { content: 'New' });
    expect(req.data).toEqual({ content: 'New' });
  });

  test('maps content to data.title for frames', () => {
    const frame: RawItem = { id: 'f', type: 'frame' };
    const req = buildUpdateRequest('frame', frame, { content: 'Title' });
    expect(req.data).toEqual({ title: 'Title' });
  });

  test('merges the unchanged axis when only one coordinate moves', () => {
    const req = buildUpdateRequest('shape', current, { x: 99 });
    expect(req.position).toEqual({ x: 99, y: 6 });
  });

  test('merges the unchanged size dimension', () => {
    const req = buildUpdateRequest('shape', current, { width: 300 });
    expect(req.geometry).toEqual({ width: 300, height: 90 });
  });

  test('never sends height for text items (width-only)', () => {
    const text: RawItem = { id: 't', type: 'text', geometry: { width: 120, height: 30 } };
    const req = buildUpdateRequest('text', text, { width: 150, height: 99 });
    expect(req.geometry).toEqual({ width: 150 });
  });

  test('maps colors to the shape style subset', () => {
    const req = buildUpdateRequest('shape', current, {
      fillColor: '#fff',
      borderColor: '#000',
      textColor: '#111',
    });
    expect(req.style).toEqual({ fillColor: '#fff', borderColor: '#000', color: '#111' });
  });

  test('frame style only takes fillColor', () => {
    const frame: RawItem = { id: 'f', type: 'frame' };
    const req = buildUpdateRequest('frame', frame, { fillColor: '#abc', borderColor: '#000' });
    expect(req.style).toEqual({ fillColor: '#abc' });
  });

  test('throws for non-updatable types', () => {
    const img: RawItem = { id: 'i', type: 'image' };
    expect(() => buildUpdateRequest('image', img, { content: 'x' })).toThrow('not supported');
  });
});
