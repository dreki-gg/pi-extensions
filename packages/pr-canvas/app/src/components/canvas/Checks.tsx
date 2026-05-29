import { For } from 'solid-js';
import type { PrCheck } from '~/lib/types';

interface ChecksProps {
  checks: PrCheck[];
}

const isSuccess = (state: string) => state.toUpperCase() === 'SUCCESS';
const isFailure = (state: string) => ['FAILURE', 'FAILED', 'ERROR'].includes(state.toUpperCase());
const statusIcon = (state: string) => (isSuccess(state) ? '✓' : isFailure(state) ? '✗' : '○');
const statusClass = (state: string) => (isSuccess(state) ? 'check-success' : isFailure(state) ? 'check-failure' : 'check-pending');

export default function Checks(props: ChecksProps) {
  const passed = () => props.checks.filter((check) => isSuccess(check.state)).length;
  const failed = () => props.checks.filter((check) => isFailure(check.state)).length;
  const pending = () => props.checks.length - passed() - failed();

  return (
    <section id="section-checks" class="canvas-section checks-section">
      <div class="section-header">
        <h2 class="section-title">CI Checks</h2>
      </div>
      <div class="pr-card checks-summary">
        <span class="check-success">{passed()} passed</span>
        <span class="check-failure">{failed()} failed</span>
        <span class="check-pending">{pending()} pending</span>
      </div>
      <div class="checks-list">
        <For each={props.checks}>
          {(check) => (
            <article class="pr-card check-item">
              <span class={`check-icon ${statusClass(check.state)}`}>{statusIcon(check.state)}</span>
              <div class="check-content">
                <h3 class="check-name">{check.name}</h3>
                <p class="check-description">{check.description}</p>
                <a class="check-details-link" href={check.detailsUrl} target="_blank" rel="noreferrer">Details</a>
              </div>
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
