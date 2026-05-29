import { For, Show, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { usePrStore } from '~/lib/context';
import Icon from '~/components/Icon';

export default function Dashboard() {
  const { store, loadPrList } = usePrStore();

  onMount(() => loadPrList());

  return (
    <div class="dashboard">
      <Title>PR Canvas</Title>
      <header class="dashboard-header">
        <h1>PR Canvas</h1>
        <p class="dashboard-subtitle">Select a Pull Request to review</p>
      </header>

      <Show when={store.error}>
        <div class="error-banner">{store.error}</div>
      </Show>

      <Show when={!store.loading} fallback={<LoadingState />}>
        <Show
          when={store.prs.length > 0}
          fallback={<EmptyState />}
        >
          <div class="pr-list">
            <For each={store.prs}>
              {(pr) => (
                <A href={`/pr/${pr.number}`} class="pr-card">
                  <div class="pr-card-header">
                    <span class="pr-number">#{pr.number}</span>
                    <span class={`state-pill state-${pr.state.toLowerCase()}`}>
                      {pr.state}
                    </span>
                  </div>
                  <h3 class="pr-title">{pr.title}</h3>
                  <div class="pr-card-meta">
                    <span class="pr-author">
                      <Icon name="user" size={14} /> {pr.author.login}
                    </span>
                    <span class="pr-stats">
                      <span class="stat-add">+{pr.additions}</span>{' '}
                      <span class="stat-del">−{pr.deletions}</span>
                    </span>
                    <Show when={pr.createdAt}>
                      <span class="pr-date">
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
    <div class="loading-state">
      <div class="spinner" />
      <p>Loading pull requests...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div class="empty-state">
      <p>No open pull requests found.</p>
      <p class="empty-hint">Make sure you're in a Git repository with open PRs.</p>
    </div>
  );
}
