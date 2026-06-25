import { createEffect, createSignal, on, onMount } from 'solid-js';
import type { FileDiffMetadata } from '@pierre/diffs';

interface FileDiffPanelProps {
  // Full unified diff for the whole PR; parsed once and indexed by file name.
  rawDiff: string;
  // Path of the file to display (matches FileDiffMetadata.name).
  path: string;
}

export default function FileDiffPanel(props: FileDiffPanelProps) {
  let containerRef: HTMLDivElement | undefined;
  let viewer: any = null;
  const [diffsByName, setDiffsByName] = createSignal<Map<string, FileDiffMetadata>>(new Map());
  const [ready, setReady] = createSignal(false);
  const [style, setStyle] = createSignal<'unified' | 'split'>('unified');

  // Parse the raw diff once (and whenever it changes) into a name -> diff map.
  createEffect(
    on(
      () => props.rawDiff,
      async (rawDiff) => {
        if (!rawDiff) {
          setDiffsByName(new Map());
          return;
        }
        const mod = await import('@pierre/diffs');
        const parsed = mod.parsePatchFiles(rawDiff);
        const map = new Map<string, FileDiffMetadata>();
        for (const patch of parsed) {
          for (const file of patch.files) {
            map.set(file.name, file);
          }
        }
        setDiffsByName(map);
        setReady(true);
      },
    ),
  );

  async function renderSelected() {
    if (!containerRef || !ready()) return;
    const fileDiff = diffsByName().get(props.path);

    // Tear down the previous viewer
    if (viewer) {
      try {
        viewer.cleanUp?.();
      } catch {
        // ignore
      }
      viewer = null;
    }
    containerRef.replaceChildren();

    if (!fileDiff) return;

    const mod = await import('@pierre/diffs');
    viewer = new mod.CodeView({
      theme: 'github-dark',
      diffStyle: style(),
      hunkSeparators: 'line-info',
    });
    viewer.setup(containerRef);
    viewer.setItems([{ id: props.path, type: 'diff' as const, fileDiff, collapsed: false }]);
  }

  onMount(renderSelected);

  // Re-render when the selected path, parsed diffs, or style change.
  createEffect(on(() => [props.path, ready(), style()] as const, renderSelected));

  return (
    <div class="flex min-h-0 flex-col">
      <div class="sticky top-0 z-[9] flex items-center justify-between gap-4 border-b border-border bg-bg-primary/[0.86] px-6 py-2.5 backdrop-blur-[10px]">
        <span class="min-w-0 truncate font-mono text-[13px] text-text-primary" title={props.path}>
          {props.path || 'Select a file'}
        </span>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center rounded-sm border border-border bg-bg-tertiary px-3 py-1.5 font-semibold text-text-primary transition-colors duration-[120ms] hover:border-border-light hover:bg-[#222831]"
          onClick={() => setStyle((s) => (s === 'unified' ? 'split' : 'unified'))}
        >
          {style() === 'unified' ? 'Split view' : 'Unified view'}
        </button>
      </div>
      <div ref={containerRef} class="px-6 pb-20 pt-4" />
    </div>
  );
}
