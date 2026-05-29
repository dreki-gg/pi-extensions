import { useParams, A } from '@solidjs/router';
import { Show, createEffect, createSignal, onMount } from 'solid-js';
import { Title } from '@solidjs/meta';
import { usePrStore } from '~/lib/context';
import ContextBar from '~/components/ContextBar';
import Icon from '~/components/Icon';
import FileChangeList from '~/components/files/FileChangeList';
import FileDiffPanel from '~/components/files/FileDiffPanel';

export default function FilesChangedRoute() {
  const params = useParams();
  const { store, loadPr, connectionStatus } = usePrStore();
  const prNumber = () => Number(params.number);
  const [selected, setSelected] = createSignal('');
  // Only expose the PR once it matches the current route param.
  const activePr = () =>
    store.currentPr && store.currentPr.number === prNumber() ? store.currentPr : undefined;

  onMount(() => {
    if (!store.currentPr || store.currentPr.number !== prNumber()) {
      loadPr(prNumber());
    }
  });

  // Auto-select the first file once data is available.
  createEffect(() => {
    const pr = store.currentPr;
    if (pr && pr.number === prNumber() && !selected() && pr.data.files.length > 0) {
      setSelected(pr.data.files[0].path);
    }
  });

  return (
    <div class="files-page">
      <Title>Files · PR #{params.number}</Title>

      <Show when={store.currentPr} fallback={<aside class="files-rail files-rail-empty" />}>
        {(pr) => (
          <aside class="files-rail">
            <A href={`/pr/${params.number}`} class="sidebar-back">
              <Icon name="back" size={16} />
              <span>Overview</span>
            </A>
            <div class="files-rail-header">
              <h2 class="files-rail-title">Files changed</h2>
              <span class="files-rail-count">{pr().data.files.length}</span>
            </div>
            <FileChangeList
              files={pr().data.files}
              selected={selected()}
              onSelect={setSelected}
            />
          </aside>
        )}
      </Show>

      <main class="files-main">
        <Show when={activePr()} fallback={<LoadingState status={connectionStatus()} />}>
          {(pr) => (
            <>
              <ContextBar pr={pr().data.overview} />
              <Show
                when={pr().data.files.length > 0}
                fallback={<div class="files-empty">This pull request has no file changes.</div>}
              >
                <FileDiffPanel rawDiff={pr().rawDiff} path={selected()} />
              </Show>
            </>
          )}
        </Show>
      </main>
    </div>
  );
}

function LoadingState(props: { status: 'connecting' | 'open' | 'closed' }) {
  return (
    <div class="loading-state">
      <Show
        when={props.status === 'closed'}
        fallback={
          <>
            <div class="spinner" />
            <p>Loading pull request...</p>
          </>
        }
      >
        <p>Can't reach the PR Canvas server.</p>
        <p class="loading-hint">
          Make sure <code>/pr-canvas start</code> is running, then reload this page.
        </p>
      </Show>
    </div>
  );
}
