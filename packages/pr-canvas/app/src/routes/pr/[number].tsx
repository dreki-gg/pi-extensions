import { useParams } from '@solidjs/router';
import { Show, onMount } from 'solid-js';
import { Title } from '@solidjs/meta';
import { usePrStore } from '~/lib/context';
import Sidebar, { type SidebarSection } from '~/components/Sidebar';
import ContextBar from '~/components/ContextBar';
import AiChat from '~/components/AiChat';
import Overview from '~/components/canvas/Overview';
import FileTree from '~/components/canvas/FileTree';
import MindMap from '~/components/canvas/MindMap';
import DiffPreview from '~/components/canvas/DiffPreview';
import Checks from '~/components/canvas/Checks';
import Comments from '~/components/canvas/Comments';
import AiSummary from '~/components/canvas/AiSummary';
import type { FullPrData } from '~/lib/types';

const FAILURE_STATES = ['FAILURE', 'FAILED', 'ERROR'];

function buildSections(pr: FullPrData): SidebarSection[] {
  const fileCount = pr.data.files.length;
  const groupCount = pr.mindMap.length;
  const failing = pr.data.checks.filter((c) => FAILURE_STATES.includes(c.state.toUpperCase())).length;
  const passing = pr.data.checks.filter((c) => c.state.toUpperCase() === 'SUCCESS').length;
  const discussion = pr.data.comments.length + pr.data.reviews.length;
  const concerns = pr.aiSummary.concerns.length;

  return [
    { id: 'section-overview', label: 'Overview', icon: 'overview' },
    {
      id: 'section-file-tree',
      label: 'Files',
      icon: 'files',
      badge: fileCount ? { text: String(fileCount), tone: 'default' } : undefined,
    },
    {
      id: 'section-mind-map',
      label: 'Mind Map',
      icon: 'mind-map',
      badge: groupCount ? { text: String(groupCount), tone: 'default' } : undefined,
    },
    { id: 'section-diff-preview', label: 'Diffs', icon: 'diff' },
    {
      id: 'section-checks',
      label: 'CI Checks',
      icon: 'checks',
      badge:
        failing > 0
          ? { text: String(failing), tone: 'danger' }
          : passing > 0
            ? { text: String(passing), tone: 'success' }
            : undefined,
    },
    {
      id: 'section-comments',
      label: 'Comments',
      icon: 'comments',
      badge: discussion ? { text: String(discussion), tone: 'default' } : undefined,
    },
    {
      id: 'section-ai-summary',
      label: 'AI Summary',
      icon: 'summary',
      badge: concerns ? { text: String(concerns), tone: 'warning' } : undefined,
    },
  ];
}

export default function PrCanvasRoute() {
  const params = useParams();
  const { store, loadPr, subscribePr, connectionStatus } = usePrStore();
  const prNumber = () => Number(params.number);

  onMount(() => {
    loadPr(prNumber());
    subscribePr(prNumber());
  });

  return (
    <div class="pr-canvas-layout">
      <Title>PR #{params.number} · PR Canvas</Title>

      <Show when={store.currentPr} fallback={<aside class="canvas-sidebar canvas-sidebar-empty" />}>
        {(currentPr) => <Sidebar sections={buildSections(currentPr())} />}
      </Show>

      <main class="pr-canvas-main">
        <Show when={store.error}>
          <div class="error-banner" role="alert">{store.error}</div>
        </Show>

        <Show when={!store.loading} fallback={<LoadingState status={connectionStatus()} />}>
          <Show when={store.currentPr} fallback={<EmptyState />}>
            {(currentPr) => (
              <>
                <ContextBar pr={currentPr().data.overview} />
                <div class="canvas-content">
                  <Overview pr={currentPr().data.overview} />
                  <FileTree files={currentPr().data.files} />
                  <MindMap groups={currentPr().mindMap} />
                  <DiffPreview rawDiff={currentPr().rawDiff} />
                  <Checks checks={currentPr().data.checks} />
                  <Comments comments={currentPr().data.comments} reviews={currentPr().data.reviews} />
                  <AiSummary summary={currentPr().aiSummary} />
                </div>
              </>
            )}
          </Show>
        </Show>
      </main>

      <AiChat prNumber={prNumber()} />
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

function EmptyState() {
  return (
    <div class="empty-state">
      <p>Pull request data is not available.</p>
    </div>
  );
}
