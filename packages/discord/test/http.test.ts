import { test, expect, afterAll } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { Effect, Layer } from 'effect';
import type { HttpClient } from '@effect/platform';
import { DiscordConfig, DiscordHttpLive, discordGet } from '../extensions/discord/client/http.js';

type DiscordRuntime = DiscordConfig | HttpClient.HttpClient;

// Local HTTP server stands in for discord.com. A patched global fetch rewrites
// requests aimed at https://discord.com/api/v10/* to this server.

let lastAuth = '';
let lastUserAgent = '';
let mode: 'ok' | 'error' | 'ratelimit' = 'ok';

const server: Server = createServer((req, res) => {
  lastAuth = req.headers.authorization ?? '';
  lastUserAgent = (req.headers['user-agent'] as string) ?? '';
  if (mode === 'ratelimit') {
    res.writeHead(429, { 'retry-after': '7', 'content-type': 'application/json' });
    res.end('{}');
    return;
  }
  if (mode === 'error') {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Missing Access', code: 50001 }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify([]));
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

const origFetch = globalThis.fetch;
globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
  const u = new URL(String(url));
  const local = `http://127.0.0.1:${port}${u.pathname.replace('/api/v10', '')}${u.search}`;
  return origFetch(local, init);
}) as typeof fetch;

afterAll(() => {
  server.close();
  globalThis.fetch = origFetch;
});

function run<A, E>(program: Effect.Effect<A, E, DiscordRuntime>, creds: { botToken: string }) {
  const layer = Layer.merge(Layer.succeed(DiscordConfig, creds), DiscordHttpLive);
  return Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
}

test('injects Bot token + User-Agent and maps 2xx array response', async () => {
  mode = 'ok';
  const exit = await run(discordGet('/guilds/1/channels', {}), { botToken: 'bot-abc' });
  expect(exit._tag).toBe('Success');
  expect(lastAuth).toBe('Bot bot-abc');
  expect(lastUserAgent).toContain('DiscordBot');
});

test('maps non-2xx to DiscordApiError', async () => {
  mode = 'error';
  const exit = await run(discordGet('/channels/1/messages', { limit: 10 }), { botToken: 'bot-abc' });
  expect(exit._tag).toBe('Failure');
});

test('rate limit response surfaces as failure', async () => {
  mode = 'ratelimit';
  const exit = await run(discordGet('/guilds/1/channels', {}), { botToken: 'bot-abc' });
  expect(exit._tag).toBe('Failure');
});
