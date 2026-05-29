import { createEffect, createSignal, on } from 'solid-js';

const DIFFS_CDN = 'https://cdn.jsdelivr.net/npm/@pierre/diffs@1.2.4/+esm';

interface DiffPreviewProps {
  rawDiff: string;
}

export default function DiffPreview(props: DiffPreviewProps) {
  let containerRef: HTMLDivElement | undefined;
  let diffsModule: any = null;
  let currentViewer: any = null;
  const [layout, setLayout] = createSignal<'stacked' | 'split'>('stacked');

  async function loadModule() {
    if (!diffsModule) {
      diffsModule = await import(/* @vite-ignore */ DIFFS_CDN);
    }
    return diffsModule;
  }

  async function renderDiffs(rawDiff: string, diffLayout: string) {
    if (!containerRef || !rawDiff) return;

    const mod = await loadModule();
    const patchFiles = mod.parsePatchFiles(rawDiff);
    if (!patchFiles || patchFiles.length === 0) return;

    // Cleanup previous viewer
    if (currentViewer) {
      try {
        currentViewer.cleanUp?.();
      } catch {
        // ignore
      }
      containerRef.replaceChildren();
    }

    // Create CodeView using the vanilla JS API:
    // new CodeView({ theme, layout, ... }) then viewer.setup(container) + viewer.setItems(items)
    currentViewer = new mod.CodeView({
      theme: 'github-dark',
      layout: diffLayout,
      hunkSeparators: 'line-info',
      lineNumbers: true,
    });

    currentViewer.setup(containerRef);

    const items = patchFiles.map((fileDiff: any, i: number) => ({
      id: `diff-${i}`,
      type: 'diff',
      fileDiff,
      collapsed: true,
    }));

    currentViewer.setItems(items);
  }

  // React to rawDiff and layout changes
  createEffect(
    on(
      () => [props.rawDiff, layout()] as const,
      ([rawDiff, diffLayout]) => {
        if (rawDiff) {
          renderDiffs(rawDiff, diffLayout);
        }
      },
    ),
  );

  return (
    <section id="section-diff-preview" class="canvas-section">
      <div class="section-header-row">
        <h2 class="section-title">📝 Diff Preview</h2>
        <button
          type="button"
          class="pierre-control-btn"
          onClick={() => setLayout((l) => (l === 'stacked' ? 'split' : 'stacked'))}
        >
          {layout() === 'stacked' ? 'Split View' : 'Unified View'}
        </button>
      </div>
      <div ref={containerRef} class="pierre-diffs-container" />
    </section>
  );
}
