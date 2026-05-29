import { useParams } from '@solidjs/router';
import { Show, onMount } from 'solid-js';
import { Title } from '@solidjs/meta';
import { usePrStore } from '~/lib/context';
import Sidebar from '~/components/Sidebar';
import AiChat from '~/components/AiChat';
import Overview from '~/components/canvas/Overview';
import FileTree from '~/components/canvas/FileTree';
import MindMap from '~/components/canvas/MindMap';
import DiffPreview from '~/components/canvas/DiffPreview';
import Checks from '~/components/canvas/Checks';
import Comments from '~/components/canvas/Comments';
import AiSummary from '~/components/canvas/AiSummary';

const SECTIONS = [
  { id: 'section-overview', label: 'Overview', icon: '📋' },
  { id: 'section-file-tree', label: 'File Tree', icon: '📁' },
  { id: 'section-mind-map', label: 'Mind Map', icon: '🧠' },
  { id: 'section-diff-preview', label: 'Diffs', icon: '📝' },
  { id: 'section-checks', label: 'CI Checks', icon: '✅' },
  { id: 'section-comments', label: 'Comments', icon: '💬' },
  { id: 'section-ai-summary', label: 'AI Summary', icon: '🤖' },
];

export default function PrCanvasRoute() {
  const params = useParams();
  const { store, loadPr, subscribePr } = usePrStore();
  const prNumber = () => Number(params.number);

  onMount(() => {
    loadPr(prNumber());
    subscribePr(prNumber());
  });

  return (
    <div class="pr-canvas-layout">
      <Title>PR #{params.number} · PR Canvas</Title>
      <Sidebar sections={SECTIONS} />

      <main class="pr-canvas-main">
        <Show when={store.error}>
          <div class="error-banner">{store.error}</div>
        </Show>

        <Show when={!store.loading} fallback={<LoadingState />}>
          <Show when={store.currentPr} fallback={<EmptyState />}>
            {(currentPr) => (
              <div class="canvas-content">
                <Overview pr={currentPr().data.overview} />
                <FileTree files={currentPr().data.files} />
                <MindMap groups={currentPr().mindMap} />
                <DiffPreview rawDiff={currentPr().rawDiff} />
                <Checks checks={currentPr().data.checks} />
                <Comments comments={currentPr().data.comments} reviews={currentPr().data.reviews} />
                <AiSummary summary={currentPr().aiSummary} />
              </div>
            )}
          </Show>
        </Show>
      </main>

      <AiChat prNumber={prNumber()} />
    </div>
  );
}

function LoadingState() {
  return (
    <div class="loading-state">
      <div class="spinner" />
      <p>Loading pull request...</p>
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
