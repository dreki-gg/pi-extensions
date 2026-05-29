import { useParams } from '@solidjs/router';
import { Show, createEffect, type JSX } from 'solid-js';
import { Title } from '@solidjs/meta';
import { usePrStore } from '~/lib/context';
import PrHeader from '~/components/PrHeader';
import PrTabs from '~/components/PrTabs';
import AiSummaryPanel from '~/components/AiSummaryPanel';
import AiChat from '~/components/AiChat';

const FAILURE_STATES = ['FAILURE', 'FAILED', 'ERROR'];

/**
 * Layout for a single pull request. Loads the PR once and frames every tab
 * (Overview / Files changed / Mind Map / PR Checks) with a shared header,
 * tab bar, and the floating AI Summary + Ask AI widgets.
 */
export default function PrLayout(props: { children?: JSX.Element }) {
  const params = useParams();
  const { store, loadPr, subscribePr, connectionStatus } = usePrStore();
  const prNumber = () => Number(params.number);
  const activePr = () =>
    store.currentPr && store.currentPr.number === prNumber() ? store.currentPr : undefined;

  // Load whenever the route param changes (handles switching PRs without remount).
  createEffect(() => {
    const n = prNumber();
    if (!store.currentPr || store.currentPr.number !== n) {
      loadPr(n);
      subscribePr(n);
    }
  });

  return (
    <div class="pr-layout">
      <Title>PR #{params.number} · PR Canvas</Title>

      <Show when={activePr()} fallback={<LoadingState status={connectionStatus()} error={store.error} />}>
        {(pr) => {
          const failing = () =>
            pr().data.checks.filter((c) => FAILURE_STATES.includes(c.state.toUpperCase())).length;
          const passing = () =>
            pr().data.checks.filter((c) => c.state.toUpperCase() === 'SUCCESS').length;

          return (
            <>
              <PrHeader pr={pr().data.overview} />
              <PrTabs
                prNumber={pr().number}
                fileCount={pr().data.files.length}
                groupCount={pr().mindMap.length}
                failingChecks={failing()}
                passingChecks={passing()}
              />
              <main class="pr-layout-content">{props.children}</main>

              <AiSummaryPanel summary={pr().aiSummary} />
              <AiChat prNumber={pr().number} />
            </>
          );
        }}
      </Show>
    </div>
  );
}

function LoadingState(props: { status: 'connecting' | 'open' | 'closed'; error: string | null }) {
  return (
    <div class="loading-state">
      <Show
        when={props.status === 'closed'}
        fallback={
          <Show when={!props.error} fallback={<p class="loading-hint">{props.error}</p>}>
            <div class="spinner" />
            <p>Loading pull request...</p>
          </Show>
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
