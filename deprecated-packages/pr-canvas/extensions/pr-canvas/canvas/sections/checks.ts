import type { PrCheck } from '../../github/types';
import { escapeHtml } from '../template';

export function renderChecks(checks: PrCheck[]): string {
  if (checks.length === 0) {
    return `
      <section class="canvas-section" id="section-checks">
        <button class="section-toggle">
          <span class="chevron">▼</span>
          <span class="section-title">✅ CI Checks</span>
        </button>
        <div class="section-body">
          <p style="color: var(--text-muted);">No checks found.</p>
        </div>
      </section>`;
  }

  const passed = checks.filter((c) => c.state === 'SUCCESS').length;
  const failed = checks.filter(
    (c) => c.state === 'FAILURE' || c.state === 'STARTUP_FAILURE',
  ).length;
  const pending = checks.length - passed - failed;

  const summary = [
    passed > 0 ? `<span class="stat-add">${passed} passed</span>` : '',
    failed > 0 ? `<span class="stat-del">${failed} failed</span>` : '',
    pending > 0 ? `<span style="color: var(--yellow);">${pending} pending</span>` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const items = checks.map(renderCheckItem).join('\n');

  return `
    <section class="canvas-section" id="section-checks">
      <button class="section-toggle">
        <span class="chevron">▼</span>
        <span class="section-title">✅ CI Checks</span>
      </button>
      <div class="section-body">
        <div class="checks-summary">${summary}</div>
        <div>${items}</div>
      </div>
    </section>`;
}

function renderCheckItem(check: PrCheck): string {
  const stateClass = getStateClass(check.state);
  const icon = getStateIcon(check.state);
  const link = check.detailsUrl
    ? `<a class="check-link" href="${escapeHtml(check.detailsUrl)}" target="_blank">Details ↗</a>`
    : '';

  return `
    <div class="check-item ${stateClass}">
      <span class="check-icon">${icon}</span>
      <span class="check-name">${escapeHtml(check.name)}</span>
      ${check.description ? `<span class="check-desc">${escapeHtml(check.description)}</span>` : ''}
      ${link}
    </div>`;
}

function getStateClass(state: string): string {
  if (state === 'SUCCESS') return 'check-pass';
  if (state === 'FAILURE' || state === 'STARTUP_FAILURE') return 'check-fail';
  return 'check-pending';
}

function getStateIcon(state: string): string {
  if (state === 'SUCCESS') return '✓';
  if (state === 'FAILURE' || state === 'STARTUP_FAILURE') return '✗';
  return '○';
}
