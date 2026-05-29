import { useParams } from '@solidjs/router';
import { Show } from 'solid-js';
import { usePrStore } from '~/lib/context';
import Checks from '~/components/canvas/Checks';

export default function ChecksTab() {
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
          <Checks checks={data().data.checks} />
        </div>
      )}
    </Show>
  );
}
