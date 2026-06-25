import { Effect, type Layer } from 'effect';
import { ExecService } from '../effect/services';
import {
  fetchOverview,
  fetchDiff,
  fetchChecks,
  fetchCommentsAndReviews,
} from '../github/client';
import { parseDiff } from '../github/parser';
import type { PrCheck, PrComment, PrData, PrReview } from '../github/types';

export interface LoadedPrPayload {
  prData: PrData;
  rawDiff: string;
}

export async function loadPrPayload(
  prRef: string,
  execLayer: Layer.Layer<ExecService>,
): Promise<LoadedPrPayload> {
  const [overview, rawDiff, checks, commentsData] = await Promise.all([
    Effect.runPromise(fetchOverview(prRef).pipe(Effect.provide(execLayer))),
    Effect.runPromise(fetchDiff(prRef).pipe(Effect.provide(execLayer))),
    Effect.runPromise(
      fetchChecks(prRef).pipe(
        Effect.provide(execLayer),
        Effect.catchAll(() => Effect.succeed([])),
      ),
    ),
    Effect.runPromise(fetchCommentsAndReviews(prRef).pipe(Effect.provide(execLayer))),
  ]);

  return {
    rawDiff,
    prData: {
      overview,
      files: parseDiff(rawDiff),
      checks: checks as PrCheck[],
      comments: commentsData.comments as PrComment[],
      reviews: commentsData.reviews as PrReview[],
    },
  };
}
