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
        <div class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,38%)_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-none">
          <aside class="flex min-h-0 flex-col overflow-y-auto border-b border-border bg-bg-secondary px-2.5 py-3.5 lg:border-b-0 lg:border-r">
            <div class="flex items-center gap-2 px-2 pb-2.5 pt-2">
              <h2 class="m-0 flex-1 text-[13px] font-semibold text-text-secondary">Files changed</h2>
              <span class="badge badge-compact">{data().data.files.length}</span>
              <span class="inline-flex gap-[3px]" title="j/k or [ ] to move between files">
                <kbd class="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] border border-b-2 border-border bg-bg-primary px-[3px] font-mono text-[10px] leading-none text-text-muted">j</kbd>
                <kbd class="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] border border-b-2 border-border bg-bg-primary px-[3px] font-mono text-[10px] leading-none text-text-muted">k</kbd>
              </span>
            </div>
            <FileTreeRail
              files={data().data.files}
              selected={selected()}
              onSelect={setSelected}
            />
          </aside>

          <div class="flex min-h-0 min-w-0 flex-col overflow-y-auto">
            <Show
              when={data().data.files.length > 0}
              fallback={<div class="px-6 py-12 text-center text-text-secondary">This pull request has no file changes.</div>}
            >
              <FileDiffPanel rawDiff={data().rawDiff} path={selected()} />
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
