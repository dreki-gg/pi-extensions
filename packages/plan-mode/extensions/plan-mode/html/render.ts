/**
 * Prototype document builder.
 *
 * A prototype is a planning-phase visual aid the agent authors freely — there
 * is no template engine and no imposed theme. Whatever HTML the agent (or a
 * delegated ux-designer subagent) writes is what the user sees.
 *
 * The only thing this does is tolerate a bare fragment: if the agent passes
 * body-only markup instead of a complete page, we drop it into a minimal,
 * UNSTYLED shell so the browser still renders it. No fonts, colors, or layout
 * are injected — the design is entirely the agent's.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** True when the markup is already a complete HTML page. */
function isFullDocument(markup: string): boolean {
  return /<!doctype\s+html|<html[\s>]/i.test(markup);
}

/**
 * Returns a standalone HTML document for the prototype. Full documents are
 * passed through verbatim; fragments are wrapped in a barebones shell.
 */
export function buildPrototypeDocument(title: string, html: string): string {
  const markup = html.trim();

  if (isFullDocument(markup)) return markup;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body>
${markup}
</body>
</html>`;
}
