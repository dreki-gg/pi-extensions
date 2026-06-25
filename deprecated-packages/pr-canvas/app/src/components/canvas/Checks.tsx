import { For, Show, createMemo } from 'solid-js';
import Icon from '~/components/Icon';
import type { PrCheck } from '~/lib/types';

interface ChecksProps {
  checks: PrCheck[];
}

const isSuccess = (state: string) => state.toUpperCase() === 'SUCCESS';
const isFailure = (state: string) => ['FAILURE', 'FAILED', 'ERROR'].includes(state.toUpperCase());

const statusOf = (state: string): 'success' | 'failure' | 'pending' =>
  isSuccess(state) ? 'success' : isFailure(state) ? 'failure' : 'pending';

// Triage order: failures first, then pending, then passing.
const RANK = { failure: 0, pending: 1, success: 2 } as const;

const badgeClass = (status: 'success' | 'failure' | 'pending') =>
  `badge ${status === 'success' ? 'badge-success' : status === 'failure' ? 'badge-danger' : 'badge-warning'}`;

const checkIconClass = (status: 'success' | 'failure' | 'pending') =>
  `inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${status === 'success' ? 'text-green bg-green/[0.14]' : status === 'failure' ? 'text-red bg-red/[0.14]' : 'text-yellow bg-yellow/[0.14]'}`;

export default function Checks(props: ChecksProps) {
  const sorted = createMemo(() =>
    [...props.checks].sort((a, b) => RANK[statusOf(a.state)] - RANK[statusOf(b.state)]),
  );
  const passed = () => props.checks.filter((c) => isSuccess(c.state)).length;
  const failed = () => props.checks.filter((c) => isFailure(c.state)).length;
  const pending = () => props.checks.length - passed() - failed();

  return (
    <section id="section-checks" class="mb-8 scroll-mt-[72px]">
      <div class="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 class="m-0 text-lg font-semibold leading-tight tracking-tight">CI Checks</h2>
        <div class="flex gap-2">
          <Show when={failed() > 0}>
            <span class={badgeClass('failure')}>
              <Icon name="cross" size={13} />
              {failed()} failing
            </span>
          </Show>
          <Show when={pending() > 0}>
            <span class={badgeClass('pending')}>
              <Icon name="dot" size={13} />
              {pending()} pending
            </span>
          </Show>
          <Show when={passed() > 0}>
            <span class={badgeClass('success')}>
              <Icon name="check" size={13} />
              {passed()} passed
            </span>
          </Show>
        </div>
      </div>

      <Show
        when={props.checks.length > 0}
        fallback={<div class="card p-[18px] text-text-secondary">No CI checks reported.</div>}
      >
        <ul class="m-0 grid list-none gap-2 p-0">
          <For each={sorted()}>
            {(check) => {
              const status = statusOf(check.state);
              return (
                <li
                  class="card flex items-start gap-3 px-3.5 py-3"
                  classList={{ 'border-red/40 bg-red/[0.06]': status === 'failure' }}
                  data-status={status}
                >
                  <span class={checkIconClass(status)}>
                    <Icon
                      name={status === 'success' ? 'check' : status === 'failure' ? 'cross' : 'dot'}
                      size={14}
                    />
                  </span>
                  <div class="min-w-0 flex-1">
                    <h3 class="m-0 text-sm font-semibold">{check.name}</h3>
                    <Show when={check.description}>
                      <p class="m-0 mt-1 text-text-secondary">{check.description}</p>
                    </Show>
                  </div>
                  <Show when={check.detailsUrl}>
                    <a
                      class="inline-flex shrink-0 items-center gap-1 font-semibold"
                      href={check.detailsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Details
                      <Icon name="external" size={13} />
                    </a>
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </section>
  );
}
