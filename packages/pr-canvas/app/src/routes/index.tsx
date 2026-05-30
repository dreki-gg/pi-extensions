import { For, Show, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { usePrStore } from '~/lib/context';
import Icon from '~/components/Icon';

const stateClass = (state: string) =>
  `badge ${['open', 'merged'].includes(state.toLowerCase()) ? 'badge-success' : state.toLowerCase() === 'closed' ? 'badge-danger' : ''}`;

export default function Dashboard() {
  const { store, loadPrList } = usePrStore();

  onMount(() => loadPrList());

  return (
    <div class="mx-auto w-full max-w-[1120px] px-4 pb-[72px] pt-7 lg:px-7 lg:pt-11">
      <Title>PR Canvas</Title>
      <header class="mb-6 border-b border-border pb-[18px]">
        <h1 class="m-0 text-[22px] leading-tight tracking-tight sm:text-[26px]">PR Canvas</h1>
        <p class="m-0 mt-2 text-text-secondary">Select a Pull Request to review</p>
      </header>

      <Show when={store.error}>
        <div class="mx-4 mt-3 rounded-sm border border-red/40 bg-red/10 px-3.5 py-3 text-[#ffb3ad] lg:mx-7 lg:mt-4">{store.error}</div>
      </Show>

      <Show when={!store.loading} fallback={<LoadingState />}>
        <Show
          when={store.prs.length > 0}
          fallback={<EmptyState />}
        >
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            <For each={store.prs}>
              {(pr) => (
                <A href={`/pr/${pr.number}`} class="card block p-4 transition-[border-color,background-color,transform] duration-[120ms] hover:-translate-y-px hover:border-border-light hover:bg-bg-tertiary hover:no-underline">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-text-muted tabular-nums">#{pr.number}</span>
                    <span class={stateClass(pr.state)}>
                      {pr.state}
                    </span>
                  </div>
                  <h3 class="mx-0 my-2.5 text-[15px] font-semibold leading-snug">{pr.title}</h3>
                  <div class="flex flex-wrap gap-x-3.5 gap-y-2.5 text-text-secondary">
                    <span class="inline-flex items-center gap-1.5">
                      <Icon name="user" size={14} /> {pr.author.login}
                    </span>
                    <span class="inline-flex gap-2 font-mono tabular-nums">
                      <span class="text-green">+{pr.additions}</span>{' '}
                      <span class="text-red">−{pr.deletions}</span>
                    </span>
                    <Show when={pr.createdAt}>
                      <span class="text-text-muted">
                        {new Date(pr.createdAt).toLocaleDateString()}
                      </span>
                    </Show>
                  </div>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

function LoadingState() {
  return (
    <div class="grid min-h-[60vh] place-items-center gap-3 text-center text-text-secondary [&_p]:m-0">
      <div class="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
      <p>Loading pull requests...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div class="grid min-h-[60vh] place-items-center gap-3 text-center text-text-secondary [&_p]:m-0">
      <p>No open pull requests found.</p>
      <p class="text-[13px] text-text-muted">Make sure you're in a Git repository with open PRs.</p>
    </div>
  );
}
