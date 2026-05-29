import { onMount } from 'solid-js';
import type { PrFile } from '~/lib/types';

const TREES_CDN = 'https://cdn.jsdelivr.net/npm/@pierre/trees@1.0.0-beta.4/+esm';

type GitStatus = 'added' | 'modified' | 'deleted' | 'renamed';

interface FileTreeProps {
  files: PrFile[];
}

export default function FileTree(props: FileTreeProps) {
  let containerRef: HTMLDivElement | undefined;

  onMount(async () => {
    if (!containerRef) return;

    const module = await import(/* @vite-ignore */ TREES_CDN);
    const paths = props.files.map((file) => file.path);
    const gitStatus = props.files.reduce<Record<string, GitStatus>>((acc, file) => {
      acc[file.path] = file.status;
      return acc;
    }, {});

    new module.FileTree(containerRef, { paths, gitStatus });
  });

  return (
    <section id="section-file-tree" class="canvas-section file-tree-section">
      <div class="section-header">
        <h2 class="section-title">File Tree</h2>
      </div>
      <div ref={containerRef} class="pr-card file-tree-container" />
    </section>
  );
}
