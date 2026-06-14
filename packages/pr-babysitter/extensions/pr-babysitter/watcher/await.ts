/**
 * Blocking "wait for the PR to resolve" engine, for the agent-callable tool.
 *
 * Unlike the background poller, this awaits a terminal verdict in a single call
 * and returns a structured report — so the agent spends one tool call instead
 * of burning turns on manual `sleep` + `gh pr checks` loops. IO, clock, and
 * sleep are injected so the loop is deterministically testable.
 */
import type { ExecFn } from '../cli/runner';
import { fetchChecks, fetchComments, fetchPrState, type PrComment } from '../engine/gh';
import {
  countHealth,
  failingCheckNames,
  formatCounts,
  type HealthCounts,
} from './state';

export type PrOutcome =
  | 'passing'
  | 'failing'
  | 'merged'
  | 'closed'
  | 'timeout'
  | 'no_checks'
  | 'cancelled';

export interface PrReport {
  pr: number;
  outcome: PrOutcome;
  checks: HealthCounts;
  failingChecks: string[];
  /** New review/bot comments observed during the wait (self excluded). */
  newComments: PrComment[];
  elapsedMs: number;
}

export interface AwaitPrDeps {
  exec: ExecFn;
  pr: number;
  selfLogin?: string;
  intervalMs: number;
  timeoutMs: number;
  /** If no checks ever register within this window, give up with `no_checks`. */
  noChecksGraceMs: number;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  onUpdate?: (status: string) => void;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** Poll the PR until its checks settle, it leaves OPEN, or we time out. */
export async function awaitPrResult(deps: AwaitPrDeps): Promise<PrReport> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const start = now();

  const seen = new Set<string>();
  const newComments: PrComment[] = [];
  let firstPoll = true;
  let counts: HealthCounts = { passing: 0, pending: 0, failing: 0 };
  let failing: string[] = [];

  const report = (outcome: PrOutcome): PrReport => ({
    pr: deps.pr,
    outcome,
    checks: counts,
    failingChecks: failing,
    newComments,
    elapsedMs: now() - start,
  });

  for (;;) {
    if (deps.signal?.aborted) return report('cancelled');

    const state = await fetchPrState(deps.exec, deps.pr);
    if (state === 'MERGED') return report('merged');
    if (state === 'CLOSED') return report('closed');

    const [checks, comments] = await Promise.all([
      fetchChecks(deps.exec, deps.pr),
      fetchComments(deps.exec, deps.pr),
    ]);

    const isFirst = firstPoll;
    firstPoll = false;
    for (const comment of comments) {
      if (seen.has(comment.id)) continue;
      seen.add(comment.id);
      // First poll baselines existing comments; only surface ones that arrive
      // during the wait, and never the human's own.
      if (!isFirst && comment.author !== deps.selfLogin) newComments.push(comment);
    }

    counts = countHealth(checks);
    failing = failingCheckNames(checks);
    const elapsed = now() - start;
    deps.onUpdate?.(`⏳ PR #${deps.pr}: ${formatCounts(counts)} (${formatElapsed(elapsed)} elapsed)`);

    if (checks.length === 0) {
      if (elapsed >= deps.noChecksGraceMs) return report('no_checks');
    } else if (counts.pending === 0) {
      return report(counts.failing > 0 ? 'failing' : 'passing');
    }

    if (elapsed >= deps.timeoutMs) return report('timeout');
    await sleep(deps.intervalMs, deps.signal);
  }
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

/** Human-readable report text returned to the agent. */
export function formatReport(report: PrReport): string {
  const head = `PR #${report.pr} — `;
  const elapsed = ` [${formatElapsed(report.elapsedMs)}]`;
  let line: string;
  switch (report.outcome) {
    case 'passing':
      line = `${head}✅ all checks passing (${formatCounts(report.checks)})${elapsed}`;
      break;
    case 'failing':
      line = `${head}❌ checks not passing: ${report.failingChecks.join(', ')} (${formatCounts(report.checks)})${elapsed}`;
      break;
    case 'merged':
      line = `${head}✅ merged${elapsed}`;
      break;
    case 'closed':
      line = `${head}🚫 closed without merging${elapsed}`;
      break;
    case 'timeout':
      line = `${head}⏱️ timed out waiting; still ${formatCounts(report.checks)}${elapsed}`;
      break;
    case 'no_checks':
      line = `${head}ℹ️ no CI checks registered${elapsed}`;
      break;
    case 'cancelled':
      line = `${head}⏹️ wait cancelled${elapsed}`;
      break;
  }

  if (report.newComments.length === 0) return line;
  const comments = report.newComments
    .map((c) => `  💬 @${c.author} (${c.kind}): "${truncate(c.body)}"`)
    .join('\n');
  return `${line}\nNew comments during wait:\n${comments}`;
}

function truncate(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
