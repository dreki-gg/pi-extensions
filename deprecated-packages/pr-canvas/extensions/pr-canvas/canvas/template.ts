/**
 * Base HTML template for the PR canvas.
 * Produces a self-contained HTML document with inline CSS and JS.
 */

export function wrapInHtml(title: string, sections: string[]): string {
  const body = sections.join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-header">PR Canvas</div>
    <div class="nav-links" id="nav-links"></div>
  </nav>
  <main class="content" id="content">
    ${body}
  </main>
  <script>${JS}</script>
  <script type="module">${MODULE_JS}</script>
</body>
</html>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CSS = `
  :root {
    --bg-primary: #0d1117;
    --bg-secondary: #161b22;
    --bg-tertiary: #1c2128;
    --border: #30363d;
    --border-light: #3d444d;
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted: #484f58;
    --accent: #58a6ff;
    --green: #3fb950;
    --red: #f85149;
    --yellow: #d29922;
    --blue: #1f6feb;
    --purple: #a371f7;
    --diff-add-bg: rgba(63, 185, 80, 0.15);
    --diff-del-bg: rgba(248, 81, 73, 0.15);
    --diff-add-border: rgba(63, 185, 80, 0.4);
    --diff-del-border: rgba(248, 81, 73, 0.4);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    display: grid;
    grid-template-columns: 200px 1fr;
    min-height: 100vh;
  }

  /* ── Sidebar ── */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 200px;
    height: 100vh;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 1.25rem 0.75rem;
    overflow-y: auto;
    z-index: 10;
  }

  .sidebar-header {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
    padding: 0 0.5rem;
  }

  .nav-link {
    display: block;
    padding: 0.45rem 0.6rem;
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-decoration: none;
    cursor: pointer;
    margin-bottom: 2px;
    transition: background 0.15s, color 0.15s;
  }
  .nav-link:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  .nav-link.active { background: var(--bg-tertiary); color: var(--text-primary); font-weight: 600; }

  /* ── Content ── */
  .content {
    grid-column: 2;
    padding: 2rem 2.5rem;
    max-width: 960px;
  }

  /* ── Section Cards ── */
  .canvas-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .section-toggle {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    user-select: none;
    width: 100%;
    background: none;
    border: none;
    color: var(--text-primary);
    font: inherit;
    text-align: left;
    padding: 0;
  }
  .section-toggle:hover { color: var(--accent); }

  .section-toggle .chevron {
    font-size: 0.7rem;
    color: var(--text-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .section-toggle .chevron.collapsed { transform: rotate(-90deg); }

  .section-title {
    font-size: 1.15rem;
    font-weight: 600;
  }

  .section-body { margin-top: 1rem; }
  .section-body.collapsed { display: none; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.4;
  }
  .badge-open { background: #238636; color: #fff; }
  .badge-closed { background: #da3633; color: #fff; }
  .badge-merged { background: #8957e5; color: #fff; }
  .badge-label { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }
  .badge-added { background: #238636; color: #fff; }
  .badge-modified { background: var(--blue); color: #fff; }
  .badge-deleted { background: #da3633; color: #fff; }
  .badge-renamed { background: var(--yellow); color: #000; }

  .badge-feature { background: var(--blue); color: #fff; }
  .badge-refactor { background: var(--purple); color: #fff; }
  .badge-fix { background: var(--red); color: #fff; }
  .badge-test { background: var(--green); color: #fff; }
  .badge-config { background: var(--yellow); color: #000; }
  .badge-docs { background: #8b949e; color: #000; }
  .badge-other { background: var(--bg-tertiary); color: var(--text-secondary); }

  .badge-sm {
    font-size: 0.65rem;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    font-weight: 700;
    font-family: 'SF Mono', 'Consolas', 'Liberation Mono', Menlo, monospace;
  }

  /* ── Review state badges ── */
  .badge-approved { background: #238636; color: #fff; }
  .badge-changes_requested { background: #da3633; color: #fff; }
  .badge-commented { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }
  .badge-dismissed { background: var(--text-muted); color: var(--text-primary); }

  /* ── Meta ── */
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin-top: 0.6rem;
  }
  .meta-item { display: flex; align-items: center; gap: 0.3rem; }

  .stat-add { color: var(--green); font-weight: 600; }
  .stat-del { color: var(--red); font-weight: 600; }

  /* ── File Tree ── */
  .file-tree { font-family: 'SF Mono', 'Consolas', monospace; font-size: 0.82rem; }
  .tree-dir { color: var(--text-muted); padding: 0.2rem 0; margin-top: 0.35rem; font-weight: 600; }
  .tree-file {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0 0.2rem 1.5rem;
  }
  .tree-file-name { flex: 1; }
  .tree-file-stats { color: var(--text-muted); font-size: 0.75rem; white-space: nowrap; }

  .change-bar {
    display: inline-flex;
    gap: 1px;
    margin-left: 0.4rem;
  }
  .change-bar-block {
    width: 6px;
    height: 6px;
    border-radius: 1px;
  }
  .change-bar-add { background: var(--green); }
  .change-bar-del { background: var(--red); }
  .change-bar-neutral { background: var(--border); }

  /* ── Diff ── */
  .diff-file { margin-bottom: 1rem; }
  .diff-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 0.82rem;
  }
  .diff-header:hover { border-color: var(--border-light); }
  .diff-content {
    border: 1px solid var(--border);
    border-top: none;
    border-radius: 0 0 6px 6px;
    overflow-x: auto;
  }
  .diff-content.collapsed { display: none; }

  .diff-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .diff-table td { padding: 0 0.75rem; white-space: pre; }
  .diff-line-num {
    width: 50px;
    text-align: right;
    color: var(--text-muted);
    user-select: none;
    padding-right: 0.5rem;
  }
  .diff-line-add { background: var(--diff-add-bg); }
  .diff-line-del { background: var(--diff-del-bg); }
  .diff-line-hunk {
    background: rgba(56, 139, 253, 0.1);
    color: var(--accent);
    font-style: italic;
  }

  /* ── Checks ── */
  .checks-summary {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
    font-size: 0.85rem;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0;
    font-size: 0.85rem;
  }
  .check-icon { font-weight: 700; width: 1.2rem; text-align: center; flex-shrink: 0; }
  .check-pass .check-icon { color: var(--green); }
  .check-fail .check-icon { color: var(--red); }
  .check-pending .check-icon { color: var(--yellow); }
  .check-name { font-weight: 500; }
  .check-desc { color: var(--text-muted); font-size: 0.8rem; margin-left: auto; }
  .check-link { color: var(--accent); text-decoration: none; font-size: 0.8rem; }
  .check-link:hover { text-decoration: underline; }

  /* ── Comments ── */
  .comment-card {
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 0.75rem;
    overflow: hidden;
  }
  .comment-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary);
    font-size: 0.82rem;
  }
  .comment-author { font-weight: 600; }
  .comment-time { color: var(--text-muted); margin-left: auto; }
  .comment-file { color: var(--accent); font-family: monospace; font-size: 0.78rem; }
  .comment-body {
    padding: 0.75rem;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--text-secondary);
  }
  .comment-body p { margin-bottom: 0.5rem; }
  .comment-body code {
    font-family: 'SF Mono', 'Consolas', monospace;
    background: var(--bg-tertiary);
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    font-size: 0.8em;
  }

  /* ── Mind Map ── */
  .mind-groups { display: grid; gap: 0.75rem; }
  .mind-group {
    padding: 0.85rem 1rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-tertiary);
  }
  .mind-group-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
  .mind-group-label { font-weight: 600; font-size: 0.95rem; }
  .mind-group-desc { color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 0.35rem; }
  .mind-group-files {
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .mind-group-files li { margin-left: 1rem; list-style: none; }
  .mind-group-files li::before { content: '•'; margin-right: 0.4rem; }

  /* ── AI Summary ── */
  .ai-block { margin-bottom: 1rem; }
  .ai-block-title { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-primary); }
  .ai-block-text { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; }
  .ai-list { list-style: none; padding: 0; }
  .ai-list li { padding: 0.2rem 0; font-size: 0.85rem; color: var(--text-secondary); }
  .ai-list li::before { content: '→'; margin-right: 0.5rem; color: var(--accent); }
  .ai-concern li::before { content: '⚠'; color: var(--yellow); }

  /* ── PR Description Markdown ── */
  .pr-body { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7; margin-top: 1rem; }
  .pr-body h1, .pr-body h2, .pr-body h3 {
    color: var(--text-primary);
    margin: 1rem 0 0.5rem;
    font-size: 1rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3rem;
  }
  .pr-body ul, .pr-body ol { padding-left: 1.5rem; margin: 0.5rem 0; }
  .pr-body li { margin-bottom: 0.2rem; }
  .pr-body code {
    font-family: 'SF Mono', 'Consolas', monospace;
    background: var(--bg-tertiary);
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    font-size: 0.85em;
  }
  .pr-body pre {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  .pr-body pre code { background: none; padding: 0; }
  .pr-body a { color: var(--accent); text-decoration: none; }
  .pr-body a:hover { text-decoration: underline; }
  .pr-body blockquote {
    border-left: 3px solid var(--border);
    padding-left: 1rem;
    color: var(--text-muted);
    margin: 0.5rem 0;
  }

  /* ── Pierre Components ── */
  #pierre-diffs-container {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  #pierre-tree-container {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg-primary);
  }

  .pierre-diff-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .pierre-control-btn {
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .pierre-control-btn:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  @media (max-width: 768px) {
    body { grid-template-columns: 1fr; }
    .sidebar { display: none; }
    .content { grid-column: 1; padding: 1rem; }
  }
`;

const JS = `
  // Build sidebar nav from sections
  document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.canvas-section');
    const navLinks = document.getElementById('nav-links');

    sections.forEach(section => {
      const titleEl = section.querySelector('.section-title');
      if (!titleEl) return;
      const link = document.createElement('a');
      link.className = 'nav-link';
      link.textContent = titleEl.textContent;
      link.href = '#' + section.id;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        section.scrollIntoView({ behavior: 'smooth' });
      });
      navLinks.appendChild(link);
    });

    // Active nav on scroll
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach(s => observer.observe(s));

    // Section collapse/expand
    document.querySelectorAll('.section-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const body = toggle.parentElement.querySelector('.section-body');
        const chevron = toggle.querySelector('.chevron');
        if (body) body.classList.toggle('collapsed');
        if (chevron) chevron.classList.toggle('collapsed');
      });
    });

  });
`;

const MODULE_JS = `
  // Initialize @pierre/diffs and @pierre/trees from CDN
  const DIFFS_CDN = 'https://cdn.jsdelivr.net/npm/@pierre/diffs@1.2.4/+esm';
  const TREES_CDN = 'https://cdn.jsdelivr.net/npm/@pierre/trees@1.0.0-beta.4/+esm';

  async function initPierreDiffs() {
    const dataEl = document.getElementById('pierre-diff-data');
    const container = document.getElementById('pierre-diffs-container');
    if (!dataEl || !container) return;

    try {
      const rawDiff = JSON.parse(dataEl.textContent);
      const { CodeView, parsePatchFiles } = await import(DIFFS_CDN);

      const patchFiles = parsePatchFiles(rawDiff);
      if (!patchFiles || patchFiles.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">Could not parse diff.</p>';
        return;
      }

      const viewer = new CodeView({
        theme: 'github-dark',
        layout: 'stacked',
        hunkSeparators: 'line-info',
        lineNumbers: true,
      });

      viewer.setup(container);

      const items = patchFiles.map((fileDiff, i) => ({
        id: 'diff-' + i,
        type: 'diff',
        fileDiff,
        collapsed: true,
      }));

      viewer.setItems(items);

      // Layout toggle
      const toggleBtn = document.getElementById('diff-layout-toggle');
      if (toggleBtn) {
        let isSplit = false;
        toggleBtn.addEventListener('click', () => {
          isSplit = !isSplit;
          viewer.cleanUp();
          const newViewer = new CodeView({
            theme: 'github-dark',
            layout: isSplit ? 'split' : 'stacked',
            hunkSeparators: 'line-info',
            lineNumbers: true,
          });
          container.innerHTML = '';
          newViewer.setup(container);
          newViewer.setItems(items);
          toggleBtn.textContent = isSplit ? 'Unified View' : 'Split View';
        });
      }
    } catch (err) {
      console.error('Failed to initialize Pierre Diffs:', err);
      container.innerHTML = '<p style="color: var(--red);">Failed to load diff viewer. Check your internet connection.</p>';
    }
  }

  async function initPierreTree() {
    const dataEl = document.getElementById('pierre-tree-data');
    const container = document.getElementById('pierre-tree-container');
    if (!dataEl || !container) return;

    try {
      const treeData = JSON.parse(dataEl.textContent);
      const { FileTree } = await import(TREES_CDN);

      const tree = new FileTree({
        paths: treeData.paths,
        gitStatus: treeData.gitStatus,
        flattenEmptyDirectories: true,
        theme: 'dark',
      });

      tree.render({ fileTreeContainer: container });
    } catch (err) {
      console.error('Failed to initialize Pierre Trees:', err);
      container.innerHTML = '<p style="color: var(--red);">Failed to load file tree. Check your internet connection.</p>';
    }
  }

  initPierreDiffs();
  initPierreTree();
`;
