/**
 * The babysitter: a single-PR polling loop.
 *
 * Lifecycle is owned here; pure decision-making lives in `state.ts` /
 * `message.ts`. IO is injected so the orchestration stays thin and the
 * extension wiring (command.ts) decides how to talk to pi.
 */
import type { ExecFn } from '../cli/runner';
import {
  fetchChecks,
  fetchComments,
  fetchPrState,
  fetchSelfLogin,
  resolveCurrentPr,
  type PrRef,
} from '../engine/gh';
import { formatLifecycleMessage, formatWakeMessage } from './message';
import type { HealthCounts } from './state';
import {
  computeNewActivity,
  countHealth,
  emptyState,
  hasActivity,
  mergeState,
  type PollSnapshot,
  type SeenState,
} from './state';

export const DEFAULT_INTERVAL_MS = 60_000;

/** Compact "2 passing, 1 pending, 1 not passing" summary (drops zero buckets). */
export function formatCounts(counts: HealthCounts): string {
  const parts: string[] = [];
  if (counts.passing) parts.push(`${counts.passing} passing`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  if (counts.failing) parts.push(`${counts.failing} not passing`);
  return parts.length > 0 ? parts.join(', ') : 'none';
}

export interface BabysitterDeps {
  exec: ExecFn;
  /** Wake the agent with a followUp user message. */
  wake: (text: string) => void;
  /** Persist seen-state (pi.appendEntry) so reload/resume does not re-fire. */
  persist: (state: SeenState) => void;
  notify: (text: string, level: 'info' | 'warning' | 'error') => void;
  setStatus: (text: string | undefined) => void;
  intervalMs?: number;
}

export interface StartResult {
  ok: boolean;
  message: string;
}

export class Babysitter {
  private timer: ReturnType<typeof setInterval> | undefined;
  private pr: PrRef | undefined;
  private state: SeenState | undefined;
  private restored: SeenState | undefined;
  private selfLogin: string | undefined;
  private lastPollAt: number | undefined;

  constructor(private readonly deps: BabysitterDeps) {}

  /** Seed seen-state from a persisted entry (called on session_start). */
  restore(state: SeenState): void {
    this.restored = state;
  }

  isWatching(): boolean {
    return this.timer !== undefined;
  }

  async start(): Promise<StartResult> {
    const pr = await resolveCurrentPr(this.deps.exec);
    if (!pr) {
      return {
        ok: false,
        message: 'No open PR found for the current branch. Open a PR, then run /babysit start.',
      };
    }
    if (pr.state !== 'OPEN') {
      return { ok: false, message: `PR #${pr.number} is ${pr.state}; nothing to babysit.` };
    }

    this.stop();
    this.pr = pr;
    this.selfLogin = await fetchSelfLogin(this.deps.exec);

    // Baseline: reuse restored state for the same PR (so previously seen items
    // never re-fire), otherwise seed silently from the current snapshot.
    const snap = await this.snapshot(pr.number);
    if (this.restored && this.restored.pr === pr.number) {
      this.state = mergeState(this.restored, snap);
    } else {
      this.state = mergeState(emptyState(pr.number), snap);
    }
    this.deps.persist(this.state);
    this.lastPollAt = Date.now();

    const interval = this.deps.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, interval);

    const counts = countHealth(snap.checks);
    this.deps.setStatus(`🍼 PR #${pr.number} — ${formatCounts(counts)}`);
    return {
      ok: true,
      message: `Watching PR #${pr.number}. Checks: ${formatCounts(counts)}. ${snap.comments.length} comment(s) baselined.`,
    };
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.deps.setStatus(undefined);
  }

  status(): string {
    if (!this.pr || !this.timer) return 'Not babysitting any PR. Run /babysit start.';
    const seen = this.state?.seenCommentIds.length ?? 0;
    const checks = Object.keys(this.state?.checkHealth ?? {}).length;
    const when = this.lastPollAt ? new Date(this.lastPollAt).toLocaleTimeString() : 'never';
    return `Babysitting PR #${this.pr.number} — ${checks} check(s), ${seen} comment(s) seen. Last poll: ${when}.`;
  }

  /**
   * One poll cycle (also driven by the interval). Public so it can be tested
   * without timers. If the PR has left OPEN (merged or closed), it wakes the
   * agent with a terminal message and stops the watch.
   */
  async pollOnce(): Promise<void> {
    if (!this.pr || !this.state) return;
    try {
      const state = await fetchPrState(this.deps.exec, this.pr.number);
      if (state && state !== 'OPEN') {
        this.deps.wake(formatLifecycleMessage(this.pr.number, state));
        this.stop();
        return;
      }

      const snap = await this.snapshot(this.pr.number);
      const activity = computeNewActivity(this.state, snap, this.selfLogin);
      this.state = mergeState(this.state, snap);
      this.deps.persist(this.state);
      this.lastPollAt = Date.now();
      if (hasActivity(activity)) {
        this.deps.wake(formatWakeMessage(activity, this.pr.number));
      }
    } catch (error) {
      this.deps.setStatus(`🍼 PR #${this.pr.number} — poll error`);
      this.deps.notify(
        `Babysitter poll failed: ${error instanceof Error ? error.message : String(error)}`,
        'warning',
      );
    }
  }

  private async snapshot(pr: number): Promise<PollSnapshot> {
    const [checks, comments] = await Promise.all([
      fetchChecks(this.deps.exec, pr),
      fetchComments(this.deps.exec, pr),
    ]);
    return { checks, comments };
  }
}
