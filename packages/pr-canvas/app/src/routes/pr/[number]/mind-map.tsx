import { useParams } from '@solidjs/router';
import { Show } from 'solid-js';
import { usePrStore } from '~/lib/context';
import MindMap from '~/components/canvas/MindMap';

export default function MindMapTab() {
  const params = useParams();
  const { store } = usePrStore();
  const pr = () =>
    store.currentPr && store.currentPr.number === Number(params.number)
      ? store.currentPr
      : undefined;

  return (
    <Show when={pr()}>
      {(data) => (
        <div class="tab-content">
          <MindMap groups={data().mindMap} />
        </div>
      )}
    </Show>
  );
}
