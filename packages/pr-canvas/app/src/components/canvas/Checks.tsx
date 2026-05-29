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

export default function Checks(props: ChecksProps) {
  const sorted = createMemo(() =>
    [...props.checks].sort((a, b) => RANK[statusOf(a.state)] - RANK[statusOf(b.state)]),
  );
  const passed = () => props.checks.filter((c) => isSuccess(c.state)).length;
  const failed = () => props.checks.filter((c) => isFailure(c.state)).length;
  const pending = () => props.checks.length - passed() - failed();

  return (
    <section id="section-checks" class="canvas-section">
      <div class="section-header">
        <h2 class="section-title">CI Checks</h2>
        <div class="checks-summary">
          <Show when={failed() > 0}>
            <span class="summary-pill summary-failure">
              <Icon name="cross" size={13} />
              {failed()} failing
            </span>
          </Show>
          <Show when={pending() > 0}>
            <span class="summary-pill summary-pending">
              <Icon name="dot" size={13} />
              {pending()} pending
            </span>
          </Show>
          <Show when={passed() > 0}>
            <span class="summary-pill summary-success">
              <Icon name="check" size={13} />
              {passed()} passed
            </span>
          </Show>
        </div>
      </div>

      <Show
        when={props.checks.length > 0}
        fallback={<div class="pr-card empty-copy-card">No CI checks reported.</div>}
      >
        <ul class="checks-list">
          <For each={sorted()}>
            {(check) => {
              const status = statusOf(check.state);
              return (
                <li class="check-item" data-status={status}>
                  <span class={`check-icon check-${status}`}>
                    <Icon
                      name={status === 'success' ? 'check' : status === 'failure' ? 'cross' : 'dot'}
                      size={14}
                    />
                  </span>
                  <div class="check-content">
                    <h3 class="check-name">{check.name}</h3>
                    <Show when={check.description}>
                      <p class="check-description">{check.description}</p>
                    </Show>
                  </div>
                  <Show when={check.detailsUrl}>
                    <a
                      class="check-details-link"
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
