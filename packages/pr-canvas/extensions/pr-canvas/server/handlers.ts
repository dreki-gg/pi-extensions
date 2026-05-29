import { Effect, Layer } from 'effect';
import { ExecService } from '../effect/services';
import { GhCliError } from '../effect/errors';
import type { AiChatError } from '../effect/errors';
import {
  fetchOverview,
  fetchDiff,
  fetchChecks,
  fetchCommentsAndReviews,
  fetchPrList,
} from '../github/client';
import { parseDiff } from '../github/parser';
import { generateReviewIntelligence } from '../ai/review-intelligence';
import type { WsMessageToServer } from '../effect/schemas';
import type { PrCheck, PrComment, PrReview } from '../github/types';

export type ExecFn = (
  command: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string; code: number }>;

export type AiChatFn = (message: string, context: string) => Promise<string>;

/**
 * Create a message handler that processes validated WebSocket messages.
 * Uses Effect internally but exposes a Promise-based API for the WS bridge.
 */
export function createMessageHandlers(exec: ExecFn, aiChat?: AiChatFn) {
  // Build an Effect Layer from the exec function
  const execLayer = Layer.succeed(ExecService, {
    exec: (command: string, args: string[]) =>
      Effect.tryPromise({
        try: () => exec(command, args),
        catch: (e) =>
          new GhCliError({ command: `${command} ${args.join(' ')}`, stderr: String(e) }),
      }) as Effect.Effect<{ stdout: string; stderr: string; code: number }, GhCliError>,
  });

  return async (msg: typeof WsMessageToServer.Type, reply: (data: object) => void) => {
    try {
      switch (msg.type) {
        case 'pr:list': {
          const prs = await Effect.runPromise(fetchPrList.pipe(Effect.provide(execLayer)));
          reply({ type: 'pr:list:result', prs });
          break;
        }

        case 'pr:data': {
          const prRef = String(msg.number);
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

          const files = parseDiff(rawDiff);
          const prData = {
            overview,
            files,
            checks: checks as PrCheck[],
            comments: commentsData.comments as PrComment[],
            reviews: commentsData.reviews as PrReview[],
          };

          const { mindMap, summary: aiSummary } = await generateReviewIntelligence(
            prData,
            rawDiff,
            aiChat,
          );

          reply({
            type: 'pr:data:result',
            number: msg.number,
            data: prData,
            rawDiff,
            mindMap,
            aiSummary,
          });
          break;
        }

        case 'pr:subscribe': {
          // For now, subscribe just acknowledges — live sync can poll later
          reply({ type: 'pr:update', number: msg.number, data: null });
          break;
        }

        case 'ai:chat': {
          if (!aiChat) {
            reply({ type: 'error', message: 'AI chat is not available' });
            break;
          }

          try {
            const response = await aiChat(msg.message, `PR #${msg.prNumber}`);
            reply({ type: 'ai:chat:response', message: response });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            reply({ type: 'error', message: `AI chat failed: ${errMsg}` });
          }
          break;
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      reply({ type: 'error', message: errMsg });
    }
  };
}
