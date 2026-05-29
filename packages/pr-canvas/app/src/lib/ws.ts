import { createSignal, onCleanup } from 'solid-js';
import type { WsMessageToServer, WsMessageFromServer } from './types';

export type WsStatus = 'connecting' | 'open' | 'closed';

export interface WsConnection {
  status: () => WsStatus;
  send: (msg: WsMessageToServer) => void;
  on: (type: string, handler: (msg: any) => void) => void;
  off: (type: string, handler: (msg: any) => void) => void;
}

/**
 * Create a WebSocket connection to the Pi bridge with auto-reconnect.
 */
export function createWsConnection(url: string): WsConnection {
  const [status, setStatus] = createSignal<WsStatus>('connecting');
  const listeners = new Map<string, Set<(msg: any) => void>>();
  // Messages requested before the socket is OPEN are queued here and
  // flushed once the connection is ready. Without this, the initial
  // pr:data request fired from onMount races the WS handshake and is
  // silently dropped, leaving the UI stuck on "Loading...".
  let pending: WsMessageToServer[] = [];
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  let disposed = false;

  function flushPending() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const queued = pending;
    pending = [];
    for (const msg of queued) {
      ws.send(JSON.stringify(msg));
    }
  }

  function connect() {
    if (disposed) return;

    setStatus('connecting');
    ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('open');
      reconnectDelay = 1000; // Reset backoff on successful connect
      flushPending();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessageFromServer;
        const handlers = listeners.get(msg.type);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg);
          }
        }
        // Also fire a wildcard '*' listener
        const wildcardHandlers = listeners.get('*');
        if (wildcardHandlers) {
          for (const handler of wildcardHandlers) {
            handler(msg);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus('closed');
      ws = null;
      // Reconnect with exponential backoff (max 30s)
      if (!disposed) {
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 1.5, 30_000);
          connect();
        }, reconnectDelay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  connect();

  // Cleanup on component disposal
  onCleanup(() => {
    disposed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
  });

  return {
    status,

    send(msg: WsMessageToServer) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      } else {
        // Queue until the socket opens (or reopens after a reconnect).
        pending.push(msg);
      }
    },

    on(type: string, handler: (msg: any) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },

    off(type: string, handler: (msg: any) => void) {
      listeners.get(type)?.delete(handler);
    },
  };
}
