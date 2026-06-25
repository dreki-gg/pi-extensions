import { describe, it, expect, afterEach } from 'bun:test';
import { createWsBridge, type WsBridge } from '../../extensions/pr-canvas/server/ws-bridge';
import WebSocket from 'ws';

const TEST_PORT = 19876;
let bridge: WsBridge | null = null;
const openClients: WebSocket[] = [];

afterEach(async () => {
  // Close all open clients first
  for (const ws of openClients) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.terminate();
    }
  }
  openClients.length = 0;

  if (bridge?.isRunning) {
    await bridge.stop();
  }
  bridge = null;

  // Small delay to ensure port is freed
  await new Promise((r) => setTimeout(r, 50));
});

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => {
      openClients.push(ws);
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function receiveMessage(ws: WebSocket): Promise<object> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

function closeClient(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState !== WebSocket.OPEN) return resolve();
    ws.on('close', () => resolve());
    ws.close();
  });
}

describe('WsBridge', () => {
  it('starts on the specified port', async () => {
    bridge = createWsBridge();
    await bridge.start(TEST_PORT);
    expect(bridge.isRunning).toBe(true);
    expect(bridge.port).toBe(TEST_PORT);
  });

  it('accepts WebSocket connections', async () => {
    bridge = createWsBridge();
    await bridge.start(TEST_PORT);

    const client = await connectClient(TEST_PORT);
    expect(client.readyState).toBe(WebSocket.OPEN);
    await closeClient(client);
  });

  it('validates messages with Schema and rejects invalid ones', async () => {
    bridge = createWsBridge();
    bridge.onMessage(async (_msg, reply) => {
      reply({ type: 'ok' });
    });
    await bridge.start(TEST_PORT);

    const client = await connectClient(TEST_PORT);
    const responsePromise = receiveMessage(client);

    client.send(JSON.stringify({ type: 'invalid_type' }));

    const response = await responsePromise;
    expect(response).toHaveProperty('type', 'error');
    await closeClient(client);
  });

  it('routes valid messages to handler and replies', async () => {
    bridge = createWsBridge();
    bridge.onMessage(async (msg, reply) => {
      if (msg.type === 'pr:list') {
        reply({ type: 'pr:list:result', prs: [] });
      }
    });
    await bridge.start(TEST_PORT);

    const client = await connectClient(TEST_PORT);
    const responsePromise = receiveMessage(client);

    client.send(JSON.stringify({ type: 'pr:list' }));

    const response = await responsePromise;
    expect(response).toEqual({ type: 'pr:list:result', prs: [] });
    await closeClient(client);
  });

  it('broadcasts to all connected clients', async () => {
    bridge = createWsBridge();
    await bridge.start(TEST_PORT);

    const client1 = await connectClient(TEST_PORT);
    const client2 = await connectClient(TEST_PORT);

    const p1 = receiveMessage(client1);
    const p2 = receiveMessage(client2);

    bridge.broadcast({ type: 'test', data: 'hello' });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ type: 'test', data: 'hello' });
    expect(r2).toEqual({ type: 'test', data: 'hello' });

    await closeClient(client1);
    await closeClient(client2);
  });

  it('stops gracefully and closes all connections', async () => {
    bridge = createWsBridge();
    await bridge.start(TEST_PORT);

    const client = await connectClient(TEST_PORT);
    const closePromise = new Promise<number>((resolve) => {
      client.on('close', (code) => resolve(code));
    });

    await bridge.stop();
    const code = await closePromise;

    expect(code).toBe(1000);
    expect(bridge.isRunning).toBe(false);
    expect(bridge.port).toBe(null);
  });
});
