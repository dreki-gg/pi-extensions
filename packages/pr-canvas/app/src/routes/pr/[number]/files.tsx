import { useParams } from '@solidjs/router';
import { Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { usePrStore } from '~/lib/context';
import FileTreeRail from '~/components/files/FileTreeRail';
import FileDiffPanel from '~/components/files/FileDiffPanel';

export default function FilesChangedTab() {
  const params = useParams();
  const { store } = usePrStore();
  const prNumber = () => Number(params.number);
  const [selected, setSelected] = createSignal('');
  const pr = () =>
    store.currentPr && store.currentPr.number === prNumber() ? store.currentPr : undefined;

  // Auto-select the first file once data is available.
  createEffect(() => {
    const data = pr();
    if (data && !selected() && data.data.files.length > 0) {
      setSelected(data.data.files[0].path);
    }
  });

  // Keyboard navigation: j/] next file, k/[ prev file.
  function stepFile(delta: number) {
    const data = pr();
    if (!data || data.data.files.length === 0) return;
    const paths = data.data.files.map((f) => f.path);
    const idx = paths.indexOf(selected());
    const base = idx === -1 ? 0 : idx;
    const next = Math.min(paths.length - 1, Math.max(0, base + delta));
    setSelected(paths[next]);
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'j':
      case ']':
        e.preventDefault();
        stepFile(1);
        break;
      case 'k':
      case '[':
        e.preventDefault();
        stepFile(-1);
        break;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  return (
    <Show when={pr()}>
      {(data) => (
        <div class="files-page">
          <aside class="files-rail">
            <div class="files-rail-header">
              <h2 class="files-rail-title">Files changed</h2>
              <span class="files-rail-count">{data().data.files.length}</span>
              <span class="files-rail-kbd" title="j/k or [ ] to move between files">
                <kbd>j</kbd>
                <kbd>k</kbd>
              </span>
            </div>
            <FileTreeRail
              files={data().data.files}
              selected={selected()}
              onSelect={setSelected}
            />
          </aside>

          <div class="files-main">
            <Show
              when={data().data.files.length > 0}
              fallback={<div class="files-empty">This pull request has no file changes.</div>}
            >
              <FileDiffPanel rawDiff={data().rawDiff} path={selected()} />
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
