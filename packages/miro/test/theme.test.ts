import { describe, expect, test } from 'bun:test';
import { GROUP_PALETTE, assignGroupThemes } from '../extensions/miro/theme.js';

const ALLOWED_FRAME_FILLS = new Set([
  '#f5f6f8',
  '#d5f692',
  '#d0e17a',
  '#93d275',
  '#67c6c0',
  '#23bfe7',
  '#a6ccf5',
  '#7b92ff',
  '#fff9b1',
  '#f5d128',
  '#ff9d48',
  '#f16c7f',
  '#ea94bb',
  '#ffcee0',
  '#b384bb',
  '#000000',
]);

describe('group theming', () => {
  test('every palette frameFill is a Miro-allowed frame color', () => {
    for (const theme of GROUP_PALETTE) {
      expect(ALLOWED_FRAME_FILLS.has(theme.frameFill)).toBe(true);
    }
  });

  test('assigns a distinct theme per group in order', () => {
    const themes = assignGroupThemes(['a', 'b', 'c']);
    expect(themes.get('a')).toBe(GROUP_PALETTE[0]);
    expect(themes.get('b')).toBe(GROUP_PALETTE[1]);
    expect(themes.get('c')).toBe(GROUP_PALETTE[2]);
  });

  test('cycles the palette when groups exceed palette size', () => {
    const ids = Array.from({ length: GROUP_PALETTE.length + 2 }, (_value, index) => `g${index}`);
    const themes = assignGroupThemes(ids);
    expect(themes.get('g0')).toBe(themes.get(`g${GROUP_PALETTE.length}`));
  });
});
