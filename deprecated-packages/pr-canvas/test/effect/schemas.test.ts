import { describe, it, expect } from 'bun:test';
import { Effect, Schema } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PrOverviewSchema,
  PrCheckSchema,
  PrListItemSchema,
  WsMessageToServer,
  WsMessageFromServer,
} from '../../extensions/pr-canvas/effect/schemas';
import {
  GhCliError,
  GhAuthError,
  GhNotFoundError,
  WsBridgeError,
  AiChatError,
} from '../../extensions/pr-canvas/effect/errors';

const fixturesDir = join(import.meta.dir, '..', 'fixtures');
function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

describe('PrOverviewSchema', () => {
  it('decodes valid gh pr view JSON', async () => {
    const raw = loadFixture('pr-view.json');
    const result = await Effect.runPromise(Schema.decode(PrOverviewSchema)(raw));
    expect(result.number).toBe(142);
    expect(result.title).toBe('Add authentication middleware');
    expect(result.author.login).toBe('jalbarran');
    expect(result.state).toBe('OPEN');
    expect(result.labels.length).toBe(2);
  });

  it('fails with ParseError on invalid data', async () => {
    const invalid = { number: 'not-a-number', title: 123 };
    const result = await Effect.runPromise(
      Schema.decode(PrOverviewSchema)(invalid).pipe(
        Effect.matchEffect({
          onSuccess: () => Effect.succeed('should-not-reach'),
          onFailure: (e) => Effect.succeed(e._tag),
        }),
      ),
    );
    expect(result).toBe('ParseError');
  });

  it('defaults missing body to empty string', async () => {
    const raw = { ...loadFixture('pr-view.json'), body: undefined };
    const result = await Effect.runPromise(Schema.decode(PrOverviewSchema)(raw));
    expect(result.body).toBe('');
  });
});

describe('PrCheckSchema', () => {
  it('decodes valid check data', async () => {
    const checks = loadFixture('pr-checks.json');
    const result = await Effect.runPromise(Schema.decode(Schema.Array(PrCheckSchema))(checks));
    expect(result.length).toBe(4);
    expect(result[0].name).toBe('Build & Test');
    expect(result[0].state).toBe('SUCCESS');
  });

  it('defaults missing fields', async () => {
    const result = await Effect.runPromise(Schema.decode(Schema.Array(PrCheckSchema))([{}]));
    expect(result[0].name).toBe('');
    expect(result[0].state).toBe('PENDING');
  });
});

describe('WsMessageToServer', () => {
  it('validates pr:list message', async () => {
    const result = await Effect.runPromise(Schema.decode(WsMessageToServer)({ type: 'pr:list' }));
    expect(result.type).toBe('pr:list');
  });

  it('validates pr:data message', async () => {
    const result = await Effect.runPromise(
      Schema.decode(WsMessageToServer)({ type: 'pr:data', number: 42 }),
    );
    expect(result).toEqual({ type: 'pr:data', number: 42 });
  });

  it('validates ai:chat message', async () => {
    const result = await Effect.runPromise(
      Schema.decode(WsMessageToServer)({
        type: 'ai:chat',
        message: 'Why was this file deleted?',
        prNumber: 42,
      }),
    );
    expect(result.type).toBe('ai:chat');
  });

  it('rejects invalid message types', async () => {
    const result = await Effect.runPromise(
      Schema.decode(WsMessageToServer)({ type: 'invalid' }).pipe(
        Effect.matchEffect({
          onSuccess: () => Effect.succeed('should-not-reach'),
          onFailure: (e) => Effect.succeed(e._tag),
        }),
      ),
    );
    expect(result).toBe('ParseError');
  });

  it('rejects pr:data without number', async () => {
    const result = await Effect.runPromise(
      Schema.decode(WsMessageToServer)({ type: 'pr:data' }).pipe(
        Effect.matchEffect({
          onSuccess: () => Effect.succeed('should-not-reach'),
          onFailure: (e) => Effect.succeed(e._tag),
        }),
      ),
    );
    expect(result).toBe('ParseError');
  });
});

describe('WsMessageFromServer', () => {
  it('validates error message', async () => {
    const result = await Effect.runPromise(
      Schema.decode(WsMessageFromServer)({ type: 'error', message: 'something broke' }),
    );
    expect(result).toEqual({ type: 'error', message: 'something broke' });
  });

  it('validates ai:chat:stream with done flag', async () => {
    const result = await Effect.runPromise(
      Schema.decode(WsMessageFromServer)({ type: 'ai:chat:stream', chunk: 'hello', done: true }),
    );
    expect(result).toEqual({ type: 'ai:chat:stream', chunk: 'hello', done: true });
  });

  it('defaults done to false when missing', async () => {
    const result = await Effect.runPromise(
      Schema.decode(WsMessageFromServer)({ type: 'ai:chat:stream', chunk: 'hi' }),
    );
    if (result.type === 'ai:chat:stream') {
      expect(result.done).toBe(false);
    }
  });
});

describe('Tagged errors', () => {
  it('GhCliError has correct _tag', () => {
    const err = new GhCliError({ command: 'pr view', stderr: 'not found' });
    expect(err._tag).toBe('GhCliError');
    expect(err.command).toBe('pr view');
    expect(err.stderr).toBe('not found');
  });

  it('GhAuthError has correct _tag', () => {
    const err = new GhAuthError({ message: 'not logged in' });
    expect(err._tag).toBe('GhAuthError');
  });

  it('GhNotFoundError has correct _tag', () => {
    const err = new GhNotFoundError({ prRef: '999' });
    expect(err._tag).toBe('GhNotFoundError');
    expect(err.prRef).toBe('999');
  });

  it('WsBridgeError has correct _tag', () => {
    const err = new WsBridgeError({ reason: 'port in use' });
    expect(err._tag).toBe('WsBridgeError');
  });

  it('AiChatError has correct _tag', () => {
    const err = new AiChatError({ message: 'model unavailable' });
    expect(err._tag).toBe('AiChatError');
  });

  it('Effect.catchTag can match specific errors', async () => {
    const program = Effect.fail(new GhCliError({ command: 'test', stderr: 'boom' })).pipe(
      Effect.catchTag('GhCliError', (e) => Effect.succeed(`caught: ${e.command}`)),
    );
    const result = await Effect.runPromise(program);
    expect(result).toBe('caught: test');
  });
});
