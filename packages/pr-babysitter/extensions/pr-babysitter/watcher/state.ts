/**
 * Seen-state tracking and the new-activity diff — the heart of the babysitter.
 *
 * Pure functions only: no IO. This is what keeps the poller from re-firing on
 * the same red check or the same comment every 60 seconds.
 */
import type { CheckRun, PrComment } from '../engine/gh';

/**
 * Tri-state check health, derived from the raw `gh` bucket:
 * - passing: `pass`, `skipping`
 * - pending: `pending` (and any unknown bucket — never wake on uncertainty)
 * - failing: `fail`, `cancel`
 */
export type CheckHealth = 'passing' | 'pending' | 'failing';

export function deriveHealth(bucket: string): CheckHealth {
  switch (bucket) {
    case 'pass':
    case 'skipping':
      return 'passing';
    case 'fail':
    case 'cancel':
      return 'failing';
    default:
      return 'pending';
  }
}

/** Persisted via `pi.appendEntry("babysit-seen", ...)`. */
export interface SeenState {
  pr: number;
  /** Last observed health per check name. */
  checkHealth: Record<string, CheckHealth>;
  /** Namespaced ids of every comment ever observed (including the human's own). */
  seenCommentIds: string[];
}

export interface PollSnapshot {
  checks: CheckRun[];
  comments: PrComment[];
}

export interface NewActivity {
  newFailedChecks: CheckRun[];
  newComments: PrComment[];
}

export interface HealthCounts {
  passing: number;
  pending: number;
  failing: number;
}

export function emptyState(pr: number): SeenState {
  return { pr, checkHealth: {}, seenCommentIds: [] };
}

export function hasActivity(activity: NewActivity): boolean {
  return activity.newFailedChecks.length > 0 || activity.newComments.length > 0;
}

/** Tally a snapshot's checks by tri-state health for status display. */
export function countHealth(checks: CheckRun[]): HealthCounts {
  const counts: HealthCounts = { passing: 0, pending: 0, failing: 0 };
  for (const check of checks) counts[deriveHealth(check.bucket)] += 1;
  return counts;
}

/** Compact "2 passing, 1 pending, 1 not passing" summary (drops zero buckets). */
export function formatCounts(counts: HealthCounts): string {
  const parts: string[] = [];
  if (counts.passing) parts.push(`${counts.passing} passing`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  if (counts.failing) parts.push(`${counts.failing} not passing`);
  return parts.length > 0 ? parts.join(', ') : 'none';
}

/** Names of checks currently in the failing state. */
export function failingCheckNames(checks: CheckRun[]): string[] {
  return checks.filter((c) => deriveHealth(c.bucket) === 'failing').map((c) => c.name);
}

/**
 * Diff a fresh snapshot against what we have already seen.
 * - A check fires only on the transition *into* `failing` (not every poll while
 *   red, and never on `pending`).
 * - A comment fires once, the first time its id is seen.
 * - The authenticated user's own comments never fire.
 */
export function computeNewActivity(
  prev: SeenState,
  snap: PollSnapshot,
  selfLogin?: string,
): NewActivity {
  const newFailedChecks = snap.checks.filter(
    (c) => deriveHealth(c.bucket) === 'failing' && prev.checkHealth[c.name] !== 'failing',
  );

  const seen = new Set(prev.seenCommentIds);
  const newComments = snap.comments.filter(
    (c) => !seen.has(c.id) && c.author !== selfLogin,
  );

  return { newFailedChecks, newComments };
}

/**
 * Fold a snapshot into the seen-state. Every comment id (including the human's
 * own) is recorded so it can never fire later; every check health is updated so
 * failing→passing→failing transitions are tracked correctly.
 */
export function mergeState(prev: SeenState, snap: PollSnapshot): SeenState {
  const checkHealth = { ...prev.checkHealth };
  for (const check of snap.checks) checkHealth[check.name] = deriveHealth(check.bucket);

  const seen = new Set(prev.seenCommentIds);
  for (const comment of snap.comments) seen.add(comment.id);

  return { pr: prev.pr, checkHealth, seenCommentIds: [...seen] };
}
