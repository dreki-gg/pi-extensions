import { Effect, Layer } from 'effect';
import { ExecService } from '../effect/services';
import { GhCliError } from '../effect/errors';
import { fetchPrList } from '../github/client';
import { buildChatContext, buildChatPrompt, type PrIntelligenceSnapshot } from '../ai/context';
import { generateReviewIntelligence } from '../ai/review-intelligence';
import type { WsMessageToServer } from '../effect/schemas';
import { loadPrPayload } from './pr-loader';

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

  const prCache = new Map<number, PrIntelligenceSnapshot>();

  async function loadSnapshot(prNumber: number): Promise<PrIntelligenceSnapshot> {
    const cached = prCache.get(prNumber);
    if (cached) return cached;

    const { prData, rawDiff } = await loadPrPayload(String(prNumber), execLayer);
    const snapshot: PrIntelligenceSnapshot = { prData, rawDiff };
    prCache.set(prNumber, snapshot);
    return snapshot;
  }

  return async (msg: typeof WsMessageToServer.Type, reply: (data: object) => void) => {
    try {
      switch (msg.type) {
        case 'pr:list': {
          const prs = await Effect.runPromise(fetchPrList.pipe(Effect.provide(execLayer)));
          reply({ type: 'pr:list:result', prs });
          break;
        }

        case 'pr:data': {
          const { prData, rawDiff } = await loadPrPayload(String(msg.number), execLayer);

          const { mindMap, summary: aiSummary } = await generateReviewIntelligence(
            prData,
            rawDiff,
            aiChat,
          );

          prCache.set(msg.number, { prData, rawDiff, mindMap, aiSummary });

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
            const snapshot = await loadSnapshot(msg.prNumber);
            const response = await aiChat(
              buildChatPrompt(msg.message),
              buildChatContext(snapshot),
            );
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
