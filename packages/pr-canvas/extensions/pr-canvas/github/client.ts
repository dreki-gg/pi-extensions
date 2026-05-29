import { Effect, Schema } from 'effect';
import { ExecService } from '../effect/services';
import { GhCliError } from '../effect/errors';
import {
  PrOverviewSchema,
  PrCheckSchema,
  PrCommentSchema,
  PrReviewSchema,
  PrListItemSchema,
} from '../effect/schemas';
import type { PrOverview, PrCheck, PrComment, PrReview } from './types';

// ── Helpers ────────────────────────────────────────────────────────────

const PR_VIEW_FIELDS = [
  'number',
  'title',
  'body',
  'author',
  'state',
  'labels',
  'reviewRequests',
  'baseRefName',
  'headRefName',
  'url',
  'additions',
  'deletions',
  'createdAt',
  'updatedAt',
  'comments',
  'reviews',
].join(',');

/** Run a `gh` command and return stdout, failing with GhCliError on non-zero exit */
const gh = (args: string[]) =>
  Effect.gen(function* () {
    const { exec } = yield* ExecService;
    const result = yield* exec('gh', args);
    if (result.code !== 0) {
      return yield* Effect.fail(
        new GhCliError({ command: `gh ${args.join(' ')}`, stderr: result.stderr }),
      );
    }
    return result.stdout;
  });

/** Parse JSON string, mapping errors to GhCliError */
const parseJson = (json: string, command: string) =>
  Effect.try({
    try: () => JSON.parse(json),
    catch: () => new GhCliError({ command, stderr: 'Invalid JSON response' }),
  });

// ── Public API ─────────────────────────────────────────────────────────

/** Fetch PR overview metadata */
export const fetchOverview = (prRef: string) =>
  Effect.gen(function* () {
    const json = yield* gh(['pr', 'view', prRef, '--json', PR_VIEW_FIELDS]);
    const raw = yield* parseJson(json, 'pr view');
    const overview = yield* Schema.decode(PrOverviewSchema)(raw).pipe(
      Effect.catchTag('ParseError', (e) =>
        Effect.fail(new GhCliError({ command: 'pr view', stderr: e.message })),
      ),
    );

    // Map reviewRequests to our reviewers format
    const reviewers = (raw.reviewRequests ?? []).map((r: { login?: string }) => ({
      login: r.login ?? 'unknown',
    }));

    return { ...overview, reviewers } as PrOverview & { reviewers: Array<{ login: string }> };
  });

/** Fetch the raw unified diff */
export const fetchDiff = (prRef: string) => gh(['pr', 'diff', prRef]);

/** Fetch CI checks */
export const fetchChecks = (prRef: string) =>
  Effect.gen(function* () {
    const json = yield* gh(['pr', 'checks', prRef, '--json', 'name,state,description,detailsUrl']);
    const raw = yield* parseJson(json, 'pr checks');
    if (!Array.isArray(raw)) return [] as PrCheck[];
    return yield* Schema.decode(Schema.Array(PrCheckSchema))(raw).pipe(
      Effect.catchTag('ParseError', () => Effect.succeed([] as PrCheck[])),
    );
  });

/** Fetch comments and reviews */
export const fetchCommentsAndReviews = (prRef: string) =>
  Effect.gen(function* () {
    const json = yield* gh(['pr', 'view', prRef, '--json', 'comments,reviews']);
    const raw = yield* parseJson(json, 'pr view comments');

    const comments = yield* Schema.decode(Schema.Array(PrCommentSchema))(raw.comments ?? []).pipe(
      Effect.catchTag('ParseError', () => Effect.succeed([] as PrComment[])),
    );

    // GitHub returns `submittedAt` for reviews (not `createdAt`); normalize it.
    const normalizedReviews = (raw.reviews ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      createdAt: r.createdAt ?? r.submittedAt ?? '',
    }));
    const reviews = yield* Schema.decode(Schema.Array(PrReviewSchema))(normalizedReviews).pipe(
      Effect.catchTag('ParseError', () => Effect.succeed([] as PrReview[])),
    );

    return { comments, reviews };
  });

/** List open PRs for the current repo */
export const fetchPrList = Effect.gen(function* () {
  const json = yield* gh([
    'pr',
    'list',
    '--json',
    'number,title,author,state,url,additions,deletions,createdAt',
  ]);
  const raw = yield* parseJson(json, 'pr list');
  if (!Array.isArray(raw)) return [];
  return yield* Schema.decode(Schema.Array(PrListItemSchema))(raw).pipe(
    Effect.catchTag('ParseError', () => Effect.succeed([])),
  );
});

// ── exec type ──────────────────────────────────────────────────────────
/** Minimal exec interface matching ExtensionAPI.exec() */
export type ExecFn = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<{ stdout: string; stderr: string; code: number }>;
