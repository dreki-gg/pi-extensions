import { createEffect, on } from 'solid-js';
import type { PrFile } from '~/lib/types';

const TREES_CDN = 'https://cdn.jsdelivr.net/npm/@pierre/trees@1.0.0-beta.4/+esm';

interface FileTreeProps {
  files: PrFile[];
}

export default function FileTree(props: FileTreeProps) {
  let containerRef: HTMLDivElement | undefined;
  let treeModule: any = null;
  let currentTree: any = null;

  // Load the module once
  async function loadModule() {
    if (!treeModule) {
      treeModule = await import(/* @vite-ignore */ TREES_CDN);
    }
    return treeModule;
  }

  // React to file changes — createEffect re-runs when props.files changes
  createEffect(
    on(
      () => props.files,
      async (files) => {
        if (!containerRef || !files || files.length === 0) return;

        const mod = await loadModule();
        const paths = files.map((f) => f.path);

        const gitStatus: Record<string, string> = {};
        for (const f of files) {
          gitStatus[f.path] = f.status;
        }

        // Dispose previous tree if any
        if (currentTree) {
          try {
            currentTree.destroy?.();
          } catch {
            // ignore
          }
          containerRef.replaceChildren();
        }

        // Create new tree using the vanilla JS API:
        // new FileTree({ paths, gitStatus, ... }) then tree.render({ fileTreeContainer })
        currentTree = new mod.FileTree({
          paths,
          gitStatus,
          flattenEmptyDirectories: true,
          theme: 'dark',
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
