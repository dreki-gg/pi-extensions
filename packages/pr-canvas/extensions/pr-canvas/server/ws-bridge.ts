import { createServer, type Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Effect, Schema } from 'effect';
import { WsMessageToServer } from '../effect/schemas';
import { WsBridgeError } from '../effect/errors';

export type MessageHandler = (
  msg: typeof WsMessageToServer.Type,
  reply: (data: object) => void,
) => Promise<void>;

export interface WsBridge {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  broadcast(message: object): void;
  onMessage(handler: MessageHandler): void;
  readonly port: number | null;
  readonly isRunning: boolean;
}

export function createWsBridge(): WsBridge {
  let httpServer: Server | null = null;
  let wss: WebSocketServer | null = null;
  let activePort: number | null = null;
  let handler: MessageHandler | null = null;
  const clients = new Set<WebSocket>();

  return {
    get port() {
      return activePort;
    },

    get isRunning() {
      return httpServer !== null && wss !== null;
    },

    onMessage(h: MessageHandler) {
      handler = h;
    },

    broadcast(message: object) {
      const data = JSON.stringify(message);
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      }
    },

    async start(port: number) {
      if (httpServer) {
        throw new WsBridgeError({ reason: 'Bridge is already running' });
      }

      httpServer = createServer();
      wss = new WebSocketServer({ server: httpServer });

      wss.on('connection', (ws) => {
        clients.add(ws);

        // Heartbeat
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 30_000);

        ws.on('message', async (raw) => {
          if (!handler) return;

          try {
            const parsed = JSON.parse(raw.toString());

            // Validate with Effect Schema
            const result = await Effect.runPromise(
              Schema.decode(WsMessageToServer)(parsed).pipe(
                Effect.matchEffect({
                  onSuccess: (msg) => Effect.succeed({ ok: true as const, msg }),
                  onFailure: (e) =>
                    Effect.succeed({ ok: false as const, error: e.message }),
                }),
              ),
            );

            if (!result.ok) {
              ws.send(
                JSON.stringify({ type: 'error', message: `Invalid message: ${result.error}` }),
              );
              return;
            }

            const reply = (data: object) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(data));
              }
            };

            await handler(result.msg, reply);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ws.send(JSON.stringify({ type: 'error', message: msg }));
          }
        });

        ws.on('close', () => {
          clearInterval(pingInterval);
          clients.delete(ws);
        });

        ws.on('error', () => {
          clearInterval(pingInterval);
          clients.delete(ws);
        });
      });

      await new Promise<void>((resolve, reject) => {
        httpServer!.listen(port, () => {
          activePort = port;
          resolve();
        });
        httpServer!.on('error', (err) => {
          reject(new WsBridgeError({ reason: err.message }));
        });
      });
    },

    async stop() {
      // Close all client connections
      for (const ws of clients) {
        ws.close(1000, 'Server shutting down');
      }
      clients.clear();

      // Close WebSocket server
      if (wss) {
        // Terminate any remaining connections the WSS knows about
        for (const client of wss.clients) {
          client.terminate();
        }
        await new Promise<void>((resolve) => {
          wss!.close(() => resolve());
        });
        wss = null;
      }

      // Close HTTP server — force close open connections
      if (httpServer) {
        httpServer.closeAllConnections();
        await new Promise<void>((resolve) => {
          httpServer!.close(() => resolve());
        });
        httpServer = null;
        activePort = null;
      }
    },
  };
}
