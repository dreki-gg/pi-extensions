import { describe, expect, test } from 'bun:test';
import { buildPrototypeDocument } from '../html/render.js';

describe('buildPrototypeDocument', () => {
  test('returns a full HTML document untouched, with no imposed wrapper', () => {
    const doc = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>My own design</title></head>
  <body style="background: salmon"><h1>Hand-crafted</h1></body>
</html>`;

    const html = buildPrototypeDocument('Sidebar redesign', doc);

    // Author's document is preserved verbatim — no badge, no theme, no panel.
    expect(html).toBe(doc.trim());
    expect(html).not.toContain('Prototype ·');
    expect(html).not.toContain('class="prototype"');
    expect(html).not.toContain('Inter');
  });

  test('recognizes a full document via <html> even without a doctype', () => {
    const doc = '<html><body><main>Hello</main></body></html>';
    const html = buildPrototypeDocument('Card', doc);
    expect(html).toBe(doc);
  });

  test('wraps a bare fragment in a minimal, unstyled shell', () => {
    const html = buildPrototypeDocument('Card', '<div class="card">Product card</div>');

    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<title>Card</title>');
    expect(html).toContain('<div class="card">Product card</div>');
    // The shell imposes no theme of its own.
    expect(html).not.toContain('background');
    expect(html).not.toContain('Inter');
  });

  test('escapes the title when used in the fallback shell', () => {
    const html = buildPrototypeDocument('A & B <script>', '<p>hi</p>');
    expect(html).toContain('<title>A &amp; B &lt;script&gt;</title>');
  });

  test('handles an empty body without throwing', () => {
    const html = buildPrototypeDocument('Empty', '');
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<title>Empty</title>');
  });
});
