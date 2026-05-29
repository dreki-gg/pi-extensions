import { createEffect, on } from 'solid-js';
import type { PrFile } from '~/lib/types';

interface FileTreeProps {
  files: PrFile[];
}

export default function FileTree(props: FileTreeProps) {
  let containerRef: HTMLDivElement | undefined;
  let currentTree: any = null;

  // Lazy-load the bundled package client-side only (it touches the DOM).
  async function loadModule() {
    return import('@pierre/trees');
  }

  // React to file changes — createEffect re-runs when props.files changes
  createEffect(
    on(
      () => props.files,
      async (files) => {
        if (!containerRef || !files || files.length === 0) return;

        const mod = await loadModule();
        const paths = files.map((f) => f.path);

        // @pierre/trees expects gitStatus as an array of { path, status }.
        const gitStatus = files.map((f) => ({ path: f.path, status: f.status }));

        // Dispose previous tree if any
        if (currentTree) {
          try {
            currentTree.destroy?.();
          } catch {
            // ignore
          }
          containerRef.replaceChildren();
        }

        // Vanilla JS API: new FileTree(options) -> render({ fileTreeContainer })
        currentTree = new mod.FileTree({
          paths,
          gitStatus,
          flattenEmptyDirectories: true,
        });

        currentTree.render({ fileTreeContainer: containerRef });
      },
    ),
  );

  const fileCount = () => props.files?.length ?? 0;
  const containerHeight = () => Math.min(fileCount() * 28 + 40, 500);

  return (
    <section id="section-file-tree" class="canvas-section">
      <div class="section-header">
        <h2 class="section-title">Files Changed</h2>
        <span class="section-count">{fileCount()} file{fileCount() !== 1 ? 's' : ''}</span>
      </div>
      <div
        ref={containerRef}
        class="pierre-tree-container"
        style={{ 'min-height': `${containerHeight()}px` }}
      />
    </section>
  );
}
