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
        <div class="flex-1 overflow-y-auto w-full px-4 pt-5 pb-20 lg:px-7 lg:pt-6 lg:pb-24">
          <div class="mx-auto w-full max-w-[1080px]">
            <Checks checks={data().data.checks} />
          </div>
        </div>
      )}
    </Show>
  );
}
