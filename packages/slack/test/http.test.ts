import { test, expect, afterAll } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { Effect, Layer } from 'effect';
import type { HttpClient } from '@effect/platform';
import { SlackConfig, SlackHttpLive, slackGet } from '../extensions/slack/client/http.js';

type SlackRuntime = SlackConfig | HttpClient.HttpClient;

// Local HTTP server stands in for slack.com. A patched global fetch rewrites
// requests aimed at https://slack.com/api/* to this server.

let lastAuth = '';
let mode: 'ok' | 'error' | 'ratelimit' = 'ok';

const server: Server = createServer((req, res) => {
  lastAuth = req.headers.authorization ?? '';
  if (mode === 'ratelimit') {
    res.writeHead(429, { 'retry-after': '7' });
    res.end('{}');
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  if (mode === 'error') res.end(JSON.stringify({ ok: false, error: 'channel_not_found' }));
  else res.end(JSON.stringify({ ok: true, channels: [] }));
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

const origFetch = globalThis.fetch;
globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
  const u = new URL(String(url));
  const local = `http://127.0.0.1:${port}${u.pathname.replace('/api', '')}${u.search}`;
  return origFetch(local, init);
}) as typeof fetch;

afterAll(() => {
  server.close();
  globalThis.fetch = origFetch;
});

function run<A, E>(
  program: Effect.Effect<A, E, SlackRuntime>,
  creds: { botToken: string; userToken?: string },
) {
  const layer = Layer.merge(Layer.succeed(SlackConfig, creds), SlackHttpLive);
  return Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
}

test('injects bearer token and maps ok response', async () => {
  mode = 'ok';
  const exit = await run(slackGet('conversations.list', { limit: 10 }), { botToken: 'xoxb-abc' });
  expect(exit._tag).toBe('Success');
  expect(lastAuth).toBe('Bearer xoxb-abc');
});

test('maps ok:false to SlackApiError', async () => {
  mode = 'error';
  const exit = await run(slackGet('conversations.history', { channel: 'C1' }), {
    botToken: 'xoxb-abc',
  });
  expect(exit._tag).toBe('Failure');
});

test('uses user token when useUserToken is set', async () => {
  mode = 'ok';
  await run(slackGet('search.messages', { query: 'x' }, { useUserToken: true }), {
    botToken: 'b',
    userToken: 'xoxp-user',
  });
  expect(lastAuth).toBe('Bearer xoxp-user');
});

test('rate limit response surfaces as failure', async () => {
  mode = 'ratelimit';
  const exit = await run(slackGet('conversations.list', {}), { botToken: 'xoxb-abc' });
  expect(exit._tag).toBe('Failure');
});
