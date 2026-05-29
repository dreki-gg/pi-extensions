import { createEffect, on, onCleanup, onMount } from 'solid-js';
import type { PrFile } from '~/lib/types';

interface FileTreeRailProps {
  files: PrFile[];
  selected: string;
  onSelect: (path: string) => void;
}

// PrFile.status maps 1:1 onto @pierre/trees GitStatus values.
type GitStatus = 'added' | 'deleted' | 'modified' | 'renamed';

/**
 * Collapsible folder tree for the Files changed rail, backed by @pierre/trees.
 * The library renders into a shadow root and is browser-only, so we import it
 * dynamically and mount it in onMount. Selection is two-way: clicks bubble up
 * via onSelect, and external selection changes (keyboard nav) are reflected by
 * scrolling/focusing the matching path.
 */
export default function FileTreeRail(props: FileTreeRailProps) {
  let containerRef: HTMLDivElement | undefined;
  let tree: any = null;
  // Guard against feedback loops when we drive selection programmatically.
  let suppressSelect = false;

  function buildPaths() {
    return props.files.map((f) => f.path);
  }

  function buildGitStatus() {
    return props.files.map((f) => ({ path: f.path, status: f.status as GitStatus }));
  }

  onMount(async () => {
    if (!containerRef) return;
    const mod = await import('@pierre/trees');
    const filePaths = new Set(props.files.map((f) => f.path));

    tree = new mod.FileTree({
      paths: buildPaths(),
      gitStatus: buildGitStatus(),
      initialExpansion: 'open',
      flattenEmptyDirectories: true,
      stickyFolders: true,
      initialSelectedPaths: props.selected ? [props.selected] : [],
      onSelectionChange: (paths: readonly string[]) => {
        if (suppressSelect) return;
        const file = paths.find((p) => filePaths.has(p));
        if (file && file !== props.selected) props.onSelect(file);
      },
    });

    tree.render({ containerWrapper: containerRef });
  });

  // Rebuild paths/status when the file set changes (e.g. PR data refresh).
  createEffect(
    on(
      () => props.files,
      (files) => {
        if (!tree) return;
        tree.resetPaths(files.map((f) => f.path));
        tree.setGitStatus(
          files.map((f) => ({ path: f.path, status: f.status as GitStatus })),
        );
      },
      { defer: true },
    ),
  );

  // Reflect externally-driven selection (keyboard j/k, [/]) into the tree.
  createEffect(
    on(
      () => props.selected,
      (path) => {
        if (!tree || !path) return;
        const item = tree.getItem(path);
        if (!item || item.isSelected()) return;
        suppressSelect = true;
        item.select();
        tree.scrollToPath(path, { focus: false, offset: 'nearest' });
        suppressSelect = false;
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    try {
      tree?.cleanUp?.();
    } catch {
      // ignore
    }
    tree = null;
  });

  return <div ref={containerRef} class="file-tree-rail" />;
}
