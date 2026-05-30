import { describe, expect, test } from 'bun:test';
import { renderPrototypeHtml } from '../html/render.js';

describe('renderPrototypeHtml', () => {
  test('renders title and intent in a minimal header', () => {
    const html = renderPrototypeHtml('Sidebar redesign', 'Left-aligned nav with icons', '.nav Nav');

    expect(html).toContain('Sidebar redesign');
    expect(html).toContain('Left-aligned nav with icons');
    expect(html).toContain('Prototype');
  });

  test('renders the Pug body markup', () => {
    const html = renderPrototypeHtml('Card', 'A product card', '.card Product card');

    expect(html).toContain('class="card"');
    expect(html).toContain('Product card');
  });

  test('does not render tasks or handoff sections', () => {
    const html = renderPrototypeHtml('Card', 'A product card', '.card Hello');

    expect(html).not.toContain('Handoff');
    expect(html).not.toContain('Tasks');
    expect(html).not.toContain('Depends on');
  });

  test('handles an empty prototype body without throwing', () => {
    const html = renderPrototypeHtml('Empty', 'Nothing yet', '');

    expect(html).toContain('Empty');
    expect(html).toContain('Nothing yet');
  });
});
