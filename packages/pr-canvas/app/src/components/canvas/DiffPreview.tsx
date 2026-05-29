import { createEffect, createSignal, on } from 'solid-js';

interface DiffPreviewProps {
  rawDiff: string;
}

export default function DiffPreview(props: DiffPreviewProps) {
  let containerRef: HTMLDivElement | undefined;
  let currentViewer: any = null;
  const [diffStyle, setDiffStyle] = createSignal<'unified' | 'split'>('unified');

  // Lazy-load the bundled package client-side only (it touches the DOM).
  async function loadModule() {
    return import('@pierre/diffs');
  }

  async function renderDiffs(rawDiff: string, style: 'unified' | 'split') {
    if (!containerRef || !rawDiff) return;

    const mod = await loadModule();
    // parsePatchFiles returns ParsedPatch[], each with a files: FileDiffMetadata[].
    // Flatten to the individual file diffs CodeView expects as `fileDiff`.
    const parsed = mod.parsePatchFiles(rawDiff);
    const fileDiffs = parsed.flatMap((patch) => patch.files);
    if (fileDiffs.length === 0) return;

    // Cleanup previous viewer
    if (currentViewer) {
      try {
        currentViewer.cleanUp?.();
      } catch {
        // ignore
      }
      containerRef.replaceChildren();
    }

    // Vanilla JS API: new CodeView(options) -> setup(container) -> setItems(items)
    currentViewer = new mod.CodeView({
      theme: 'github-dark',
      diffStyle: style,
      hunkSeparators: 'line-info',
    });

    currentViewer.setup(containerRef);

    const items = fileDiffs.map((fileDiff, i) => ({
      id: `diff-${i}`,
      type: 'diff' as const,
      fileDiff,
      collapsed: true,
    }));

    currentViewer.setItems(items);
  }

  // React to rawDiff and diffStyle changes
  createEffect(
    on(
      () => [props.rawDiff, diffStyle()] as const,
      ([rawDiff, style]) => {
        if (rawDiff) {
          renderDiffs(rawDiff, style);
        }
      },
    ),
  );

  return (
    <section id="section-diff-preview" class="canvas-section">
      <div class="section-header-row">
        <h2 class="section-title">Diff</h2>
        <button
          type="button"
          class="pierre-control-btn"
          onClick={() => setDiffStyle((s) => (s === 'unified' ? 'split' : 'unified'))}
        >
          {diffStyle() === 'unified' ? 'Split view' : 'Unified view'}
        </button>
      </div>
      <div ref={containerRef} class="pierre-diffs-container" />
    </section>
  );
}
