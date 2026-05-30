import { useParams } from '@solidjs/router';
import { Show } from 'solid-js';
import { usePrStore } from '~/lib/context';
import Overview from '~/components/canvas/Overview';
import Comments from '~/components/canvas/Comments';

export default function OverviewTab() {
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
            <Overview pr={data().data.overview} />
            <Comments comments={data().data.comments} reviews={data().data.reviews} />
          </div>
        </div>
      )}
    </Show>
  );
}
